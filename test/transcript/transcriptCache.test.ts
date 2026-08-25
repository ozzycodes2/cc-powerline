import { describe, it, expect } from 'vitest';
import {
  parseChunk,
  loadTranscriptTotals,
  type TranscriptDeps,
} from '../../src/transcript/transcriptCache.js';
import type { PricingTable } from '../../src/types/Pricing.js';

const PRICING: PricingTable = {
  m: { input: 1e-6, output: 2e-6, cacheCreate: 1e-6, cacheRead: 1e-7 },
};

const line = (input: number) =>
  JSON.stringify({
    type: 'assistant',
    message: { model: 'm', usage: { input_tokens: input } },
  });

/** In-memory transcript file + cache store for exercising the incremental path. */
function fakeDeps(initial: string): {
  deps: TranscriptDeps;
  append: (text: string) => void;
  replace: (text: string) => void;
} {
  let content = Buffer.from(initial, 'utf8');
  let store: Record<string, unknown> = {};
  const deps: TranscriptDeps = {
    stat: async () => ({ size: content.length }),
    readRange: async (_p, start, end) => content.subarray(start, end),
    readStore: async () => structuredClone(store) as never,
    writeStore: async (s) => {
      store = structuredClone(s);
    },
  };
  return {
    deps,
    append: (text) => {
      content = Buffer.concat([content, Buffer.from(text, 'utf8')]);
    },
    replace: (text) => {
      content = Buffer.from(text, 'utf8');
    },
  };
}

describe('parseChunk', () => {
  it('parses only the complete-line prefix and reports bytes consumed', () => {
    const buf = Buffer.from(
      `${line(1000)}\n${line(500)}\n${line(999)}`,
      'utf8',
    ); // last line has no \n
    const { delta, consumed } = parseChunk(buf, PRICING);
    expect(delta.inputTokens).toBe(1500); // third (partial) line excluded
    expect(consumed).toBe(`${line(1000)}\n${line(500)}\n`.length);
  });

  it('consumes nothing when there is no complete line', () => {
    const { delta, consumed } = parseChunk(
      Buffer.from(line(1000), 'utf8'),
      PRICING,
    );
    expect(consumed).toBe(0);
    expect(delta.inputTokens).toBe(0);
  });
});

describe('loadTranscriptTotals', () => {
  it('returns zeros for a missing path or missing file', async () => {
    const { deps } = fakeDeps('');
    expect((await loadTranscriptTotals(undefined, PRICING, deps)).costUsd).toBe(
      0,
    );
    const gone: TranscriptDeps = { ...deps, stat: async () => null };
    expect((await loadTranscriptTotals('/x', PRICING, gone)).costUsd).toBe(0);
  });

  it('parses a full file then folds in only appended bytes', async () => {
    const t = fakeDeps(`${line(1000)}\n`);
    const first = await loadTranscriptTotals('/t', PRICING, t.deps);
    expect(first.inputTokens).toBe(1000);

    t.append(`${line(500)}\n`);
    const second = await loadTranscriptTotals('/t', PRICING, t.deps);
    expect(second.inputTokens).toBe(1500); // additive, not re-counted
  });

  it('re-parses from scratch when the file shrinks (rewrite)', async () => {
    const t = fakeDeps(`${line(1000)}\n${line(1000)}\n`);
    const first = await loadTranscriptTotals('/t', PRICING, t.deps);
    expect(first.inputTokens).toBe(2000);

    t.replace(`${line(7)}\n`);
    const second = await loadTranscriptTotals('/t', PRICING, t.deps);
    expect(second.inputTokens).toBe(7);
  });

  it('does not reset the running cost across a compaction append', async () => {
    const t = fakeDeps(`${line(1000)}\n`);
    const first = await loadTranscriptTotals('/t', PRICING, t.deps);
    t.append(
      `${JSON.stringify({ type: 'system', subtype: 'compact_boundary' })}\n`,
    );
    const second = await loadTranscriptTotals('/t', PRICING, t.deps);
    expect(second.costUsd).toBeCloseTo(first.costUsd, 12);
    expect(second.compactions).toBe(1);
  });
});

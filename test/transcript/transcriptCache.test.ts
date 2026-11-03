import { describe, it, expect } from 'vitest';
import {
  parseChunk,
  loadTranscriptTotals,
  type TranscriptDeps,
} from '../../src/transcript/transcriptCache.js';
import { ZERO_TOTALS } from '../../src/transcript/parseTranscript.js';
import type { PricingTable } from '../../src/types/Pricing.js';

const PRICING: PricingTable = {
  m: { input: 1e-6, output: 2e-6, cacheCreate: 1e-6, cacheRead: 1e-7 },
};

const line = (input: number) =>
  JSON.stringify({
    type: 'assistant',
    message: { model: 'm', usage: { input_tokens: input } },
  });

const msg = (id: string, input: number) =>
  JSON.stringify({
    type: 'assistant',
    requestId: `req-${id}`,
    message: { id, model: 'm', usage: { input_tokens: input } },
  });

/**
 * In-memory transcript files + cache store for exercising the incremental
 * path. `/t` is the main transcript; `subagents` lists paths returned for it.
 */
function fakeDeps(
  initial: string,
  subagents: string[] = [],
): {
  deps: TranscriptDeps;
  files: Map<string, Buffer>;
  store: () => Record<string, Record<string, unknown>>;
  append: (text: string, path?: string) => void;
  replace: (text: string, path?: string) => void;
} {
  const files = new Map<string, Buffer>([['/t', Buffer.from(initial, 'utf8')]]);
  let store: Record<string, Record<string, unknown>> = {};
  const deps: TranscriptDeps = {
    stat: async (p) => {
      const f = files.get(p);
      return f ? { size: f.length } : null;
    },
    readRange: async (p, start, end) => files.get(p)!.subarray(start, end),
    listSubagents: async () => subagents,
    readStore: async () => structuredClone(store) as never,
    writeStore: async (s) => {
      store = structuredClone(s) as never;
    },
  };
  return {
    deps,
    files,
    store: () => store,
    append: (text, path = '/t') => {
      const prev = files.get(path) ?? Buffer.alloc(0);
      files.set(path, Buffer.concat([prev, Buffer.from(text, 'utf8')]));
    },
    replace: (text, path = '/t') => {
      files.set(path, Buffer.from(text, 'utf8'));
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

  it('counts a message split across a read boundary once', async () => {
    const t = fakeDeps(`${msg('a', 1000)}\n`);
    await loadTranscriptTotals('/t', PRICING, t.deps);
    t.append(`${msg('a', 1000)}\n${msg('b', 5)}\n`);
    const second = await loadTranscriptTotals('/t', PRICING, t.deps);
    expect(second.inputTokens).toBe(1005);
  });

  it('re-parses entries cached by an older version', async () => {
    const t = fakeDeps(`${msg('a', 1000)}\n${msg('a', 1000)}\n`);
    await loadTranscriptTotals('/t', PRICING, t.deps);
    const entry = t.store()['/t']!;
    delete entry.version;
    entry.totals = { ...(entry.totals as object), inputTokens: 2000 };
    const again = await loadTranscriptTotals('/t', PRICING, t.deps);
    expect(again.inputTokens).toBe(1000);
  });
});

describe('loadTranscriptTotals with subagents', () => {
  it("adds subagent spend but keeps the main transcript's context and cache state", async () => {
    const t = fakeDeps(
      `${JSON.stringify({
        type: 'assistant',
        timestamp: '2026-01-01T00:00:00.000Z',
        message: {
          model: 'm',
          usage: { input_tokens: 100, cache_creation_input_tokens: 50 },
        },
      })}\n`,
      ['/t/subagents/agent-1.jsonl', '/t/subagents/agent-2.jsonl'],
    );
    t.replace(`${line(1000)}\n`, '/t/subagents/agent-1.jsonl');
    t.replace(
      `${JSON.stringify({
        type: 'assistant',
        timestamp: '2026-06-01T00:00:00.000Z',
        message: {
          model: 'm',
          usage: {
            input_tokens: 7,
            output_tokens: 3,
            cache_read_input_tokens: 11,
            cache_creation: { ephemeral_1h_input_tokens: 13 },
          },
        },
      })}\n${JSON.stringify({ type: 'system', subtype: 'compact_boundary' })}\n`,
      '/t/subagents/agent-2.jsonl',
    );

    const totals = await loadTranscriptTotals('/t', PRICING, t.deps);
    expect(totals.inputTokens).toBe(100 + 1000 + 7);
    expect(totals.outputTokens).toBe(3);
    expect(totals.cacheReadTokens).toBe(11);
    expect(totals.cacheCreationTokens).toBe(50 + 13);
    expect(totals.costUsd).toBeCloseTo(
      150e-6 + 1000e-6 + (7e-6 + 6e-6 + 11e-7 + 13 * 2e-6),
      12,
    );
    expect(totals.contextTokens).toBe(150);
    expect(totals.cacheTtlMs).toBe(5 * 60 * 1000);
    expect(totals.cacheExpiresAt).toBe(
      Date.parse('2026-01-01T00:00:00.000Z') + 5 * 60 * 1000,
    );
    expect(totals.compactions).toBe(0);
  });

  it('folds in appended subagent bytes incrementally', async () => {
    const sub = '/t/subagents/agent-1.jsonl';
    const t = fakeDeps(`${line(1)}\n`, [sub]);
    t.replace(`${line(10)}\n`, sub);
    expect(
      (await loadTranscriptTotals('/t', PRICING, t.deps)).inputTokens,
    ).toBe(11);
    t.append(`${line(100)}\n`, sub);
    expect(
      (await loadTranscriptTotals('/t', PRICING, t.deps)).inputTokens,
    ).toBe(111);
  });

  it('skips a listed subagent whose file is gone', async () => {
    const t = fakeDeps(`${line(1)}\n`, ['/t/subagents/agent-gone.jsonl']);
    expect(
      (await loadTranscriptTotals('/t', PRICING, t.deps)).inputTokens,
    ).toBe(1);
  });

  it('ignores subagents when the main transcript is missing', async () => {
    const t = fakeDeps('', ['/t/subagents/agent-1.jsonl']);
    t.files.delete('/t');
    t.replace(`${line(10)}\n`, '/t/subagents/agent-1.jsonl');
    expect(await loadTranscriptTotals('/t', PRICING, t.deps)).toEqual(
      ZERO_TOTALS,
    );
  });
});

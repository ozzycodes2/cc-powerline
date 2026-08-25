import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  defaultTranscriptDeps,
  loadTranscriptTotals,
  transcriptCachePath,
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

const created: string[] = [];
afterEach(async () => {
  await Promise.all(
    created.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});
async function tmp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ccpl-tr-'));
  created.push(dir);
  return dir;
}

describe('transcriptCachePath', () => {
  it('honors XDG_CACHE_HOME', () => {
    const prev = process.env.XDG_CACHE_HOME;
    process.env.XDG_CACHE_HOME = '/tmp/xdg';
    try {
      expect(transcriptCachePath()).toBe(
        '/tmp/xdg/cc-powerline/transcript-cache.json',
      );
    } finally {
      if (prev === undefined) delete process.env.XDG_CACHE_HOME;
      else process.env.XDG_CACHE_HOME = prev;
    }
  });
});

describe('defaultTranscriptDeps (real filesystem)', () => {
  it('parses a real transcript file and folds in appended bytes on the next call', async () => {
    const dir = await tmp();
    const transcript = join(dir, 't.jsonl');
    const cachePath = join(dir, 'cache.json');
    const deps = defaultTranscriptDeps(cachePath);

    await writeFile(transcript, `${line(1000)}\n`, 'utf8');
    const first = await loadTranscriptTotals(transcript, PRICING, deps);
    expect(first.inputTokens).toBe(1000);

    await writeFile(transcript, `${line(1000)}\n${line(500)}\n`, 'utf8');
    const second = await loadTranscriptTotals(transcript, PRICING, deps);
    expect(second.inputTokens).toBe(1500); // read only the appended tail
  });

  it('reports null stat for a missing file', async () => {
    const deps = defaultTranscriptDeps(join(await tmp(), 'cache.json'));
    expect(await deps.stat(join(await tmp(), 'nope.jsonl'))).toBeNull();
  });

  it('returns an empty store when the cache file is absent', async () => {
    const deps = defaultTranscriptDeps(join(await tmp(), 'absent.json'));
    expect(await deps.readStore()).toEqual({});
  });
});

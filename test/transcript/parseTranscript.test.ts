import { describe, it, expect } from 'vitest';
import {
  parseTranscript,
  mergeTotals,
  ZERO_TOTALS,
} from '../../src/transcript/parseTranscript.js';
import type { PricingTable } from '../../src/types/Pricing.js';

const PRICING: PricingTable = {
  m: { input: 1e-6, output: 2e-6, cacheCreate: 1e-6, cacheRead: 1e-7 },
};

const assistant = (usage: Record<string, unknown>) =>
  JSON.stringify({ type: 'assistant', message: { model: 'm', usage } });

describe('parseTranscript', () => {
  it('sums cost and tokens across assistant messages', () => {
    const jsonl = [
      assistant({ input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 2000 }),
      assistant({ input_tokens: 100, output_tokens: 50 }),
    ].join('\n');
    const r = parseTranscript(jsonl, PRICING);
    // 0.0022 + 0.0002 = 0.0024
    expect(r.costUsd).toBeCloseTo(0.0022 + (100 * 1e-6 + 50 * 2e-6), 12);
    expect(r.inputTokens).toBe(1100);
    expect(r.outputTokens).toBe(550);
    expect(r.cacheReadTokens).toBe(2000);
    expect(r.lastContextTokens).toBe(100); // last message: 100 + 0 + 0
  });

  it('uses the cache-creation breakdown when present', () => {
    const r = parseTranscript(
      assistant({
        input_tokens: 0,
        cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 20 },
      }),
      PRICING,
    );
    expect(r.cacheCreationTokens).toBe(30);
  });

  it('counts compaction events without adding cost', () => {
    const jsonl = [
      assistant({ input_tokens: 1000 }),
      JSON.stringify({ type: 'system', subtype: 'compact_boundary' }),
    ].join('\n');
    const r = parseTranscript(jsonl, PRICING);
    expect(r.compactions).toBe(1);
    expect(r.costUsd).toBeCloseTo(0.001, 12);
  });

  it('tolerates blank and corrupt lines', () => {
    const jsonl = ['', '{bad json', assistant({ input_tokens: 1000 }), ''].join('\n');
    expect(parseTranscript(jsonl, PRICING).inputTokens).toBe(1000);
  });

  it('skips entries with no usage', () => {
    const jsonl = JSON.stringify({ type: 'user', message: { content: 'hi' } });
    expect(parseTranscript(jsonl, PRICING).inputTokens).toBe(0);
  });
});

describe('mergeTotals', () => {
  it('adds deltas and replaces contextTokens from the newest chunk', () => {
    const prev = { ...ZERO_TOTALS, costUsd: 1, inputTokens: 10, contextTokens: 99 };
    const merged = mergeTotals(prev, {
      costUsd: 0.5,
      inputTokens: 5,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      compactions: 1,
      lastContextTokens: 42,
      lastCacheExpiresAt: 1000,
      lastCacheTtlMs: 300_000,
    });
    expect(merged.costUsd).toBe(1.5);
    expect(merged.inputTokens).toBe(15);
    expect(merged.compactions).toBe(1);
    expect(merged.contextTokens).toBe(42);
    expect(merged.cacheExpiresAt).toBe(1000);
    expect(merged.cacheTtlMs).toBe(300_000);
  });

  it('keeps the previous contextTokens and cache state when the chunk had no messages', () => {
    const prev = { ...ZERO_TOTALS, contextTokens: 99, cacheExpiresAt: 500, cacheTtlMs: 3_600_000 };
    const merged = mergeTotals(prev, {
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      compactions: 0,
      lastContextTokens: null,
      lastCacheExpiresAt: null,
      lastCacheTtlMs: null,
    });
    expect(merged.contextTokens).toBe(99);
    expect(merged.cacheExpiresAt).toBe(500);
    expect(merged.cacheTtlMs).toBe(3_600_000);
  });
});

describe('parseTranscript cache expiry', () => {
  const at = (ts: string, usage: Record<string, unknown>) =>
    JSON.stringify({ type: 'assistant', timestamp: ts, message: { model: 'm', usage } });

  it('sets a 5-minute expiry from a cache-creating message timestamp', () => {
    const r = parseTranscript(
      at('2026-08-21T00:00:00.000Z', { input_tokens: 1, cache_creation_input_tokens: 100 }),
      PRICING,
    );
    expect(r.lastCacheExpiresAt).toBe(Date.parse('2026-08-21T00:05:00.000Z'));
    expect(r.lastCacheTtlMs).toBe(5 * 60 * 1000);
  });

  it('uses the 1-hour window when the message created 1h cache', () => {
    const r = parseTranscript(
      at('2026-08-21T00:00:00.000Z', {
        input_tokens: 1,
        cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 50 },
      }),
      PRICING,
    );
    expect(r.lastCacheExpiresAt).toBe(Date.parse('2026-08-21T01:00:00.000Z'));
    expect(r.lastCacheTtlMs).toBe(60 * 60 * 1000);
  });

  it('ignores messages that only read cache or lack a timestamp', () => {
    const readOnly = at('2026-08-21T00:00:00.000Z', {
      input_tokens: 1,
      cache_read_input_tokens: 100,
    });
    expect(parseTranscript(readOnly, PRICING).lastCacheExpiresAt).toBeNull();

    const noTs = JSON.stringify({
      type: 'assistant',
      message: { model: 'm', usage: { cache_creation_input_tokens: 100 } },
    });
    const noTsResult = parseTranscript(noTs, PRICING);
    expect(noTsResult.lastCacheExpiresAt).toBeNull();
    // The tier needs no timestamp, so a cache write still pins down the TTL.
    expect(noTsResult.lastCacheTtlMs).toBe(5 * 60 * 1000);
  });
});

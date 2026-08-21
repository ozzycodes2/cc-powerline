import { describe, it, expect, vi } from 'vitest';
import {
  resolvePricing,
  type ResolvePricingDeps,
} from '../../src/pricing/resolvePricing.js';
import type { PricingTable } from '../../src/types/Pricing.js';

const CACHE_TABLE: PricingTable = { 'from-cache': { input: 1, output: 2, cacheCreate: 1, cacheRead: 1 } };
const NET_TABLE: PricingTable = { 'from-net': { input: 3, output: 4, cacheCreate: 1, cacheRead: 1 } };
const EMBEDDED: PricingTable = { 'from-embedded': { input: 5, output: 6, cacheCreate: 1, cacheRead: 1 } };

function deps(over: Partial<ResolvePricingDeps>): Partial<ResolvePricingDeps> {
  return {
    now: () => 1_000_000,
    ttlMs: 1000,
    readCache: async () => null,
    writeCache: async () => true,
    fetchTable: async () => null,
    embedded: EMBEDDED,
    ...over,
  };
}

describe('resolvePricing', () => {
  it('uses a fresh cache and skips the network', async () => {
    const fetchTable = vi.fn(async () => NET_TABLE);
    const res = await resolvePricing(
      deps({
        readCache: async () => ({ fetchedAt: 999_500, table: CACHE_TABLE }),
        fetchTable,
      }),
    );
    expect(res.source).toBe('cache');
    expect(res.table).toBe(CACHE_TABLE);
    expect(fetchTable).not.toHaveBeenCalled();
  });

  it('fetches and writes the cache on a cache miss', async () => {
    const writeCache = vi.fn(async () => true);
    const res = await resolvePricing(
      deps({ readCache: async () => null, fetchTable: async () => NET_TABLE, writeCache }),
    );
    expect(res.source).toBe('network');
    expect(res.table).toBe(NET_TABLE);
    expect(writeCache).toHaveBeenCalledWith(NET_TABLE, 1_000_000);
  });

  it('refetches when the cache is older than the TTL', async () => {
    const res = await resolvePricing(
      deps({
        readCache: async () => ({ fetchedAt: 0, table: CACHE_TABLE }), // stale
        fetchTable: async () => NET_TABLE,
      }),
    );
    expect(res.source).toBe('network');
    expect(res.table).toBe(NET_TABLE);
  });

  it('falls back to a stale cache when the network fails', async () => {
    const res = await resolvePricing(
      deps({
        readCache: async () => ({ fetchedAt: 0, table: CACHE_TABLE }), // stale
        fetchTable: async () => null, // network down
      }),
    );
    expect(res.source).toBe('cache');
    expect(res.table).toBe(CACHE_TABLE);
  });

  it('falls back to the embedded snapshot with no cache and no network', async () => {
    const res = await resolvePricing(
      deps({ readCache: async () => null, fetchTable: async () => null }),
    );
    expect(res.source).toBe('embedded');
    expect(res.table).toBe(EMBEDDED);
  });

  it('does not throw when the cache write fails', async () => {
    const res = await resolvePricing(
      deps({
        readCache: async () => null,
        fetchTable: async () => NET_TABLE,
        writeCache: async () => false,
      }),
    );
    expect(res.source).toBe('network');
  });
});

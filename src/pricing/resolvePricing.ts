/**
 * Resolve a pricing table: fresh on-disk cache → network fetch (LiteLLM) →
 * embedded Anthropic-only snapshot. Never throws — a statusline that crashes
 * is user-visible in Claude Code, so pricing resolution always yields a
 * usable table.
 */
import {
  normalizePricingEntry,
  type PricingTable,
  type RawLiteLLMEntry,
} from '../types/Pricing.js';
import { EMBEDDED_PRICING } from './embeddedFallback.js';
import {
  readPricingCache,
  writePricingCache,
  type CachedPricing,
} from './pricingCache.js';

export const LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

/** Cache lifetime: refetch at most once a day. */
export const PRICING_TTL_MS = 24 * 60 * 60 * 1000;

export type PricingSource = 'cache' | 'network' | 'embedded';

export interface ResolvedPricing {
  table: PricingTable;
  source: PricingSource;
}

/** Injectable dependencies, so tests can drive every branch without real IO. */
export interface ResolvePricingDeps {
  now: () => number;
  ttlMs: number;
  readCache: () => Promise<CachedPricing | null>;
  writeCache: (table: PricingTable, now: number) => Promise<boolean>;
  fetchTable: () => Promise<PricingTable | null>;
  embedded: PricingTable;
}

/** Fetch and normalize the full LiteLLM table. Returns `null` on any failure. */
export async function fetchLiteLLMTable(
  url = LITELLM_URL,
): Promise<PricingTable | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const raw = (await res.json()) as Record<string, RawLiteLLMEntry>;
    const table: PricingTable = {};
    for (const [name, entry] of Object.entries(raw)) {
      if (name === 'sample_spec') {
        continue;
      }
      const pricing = normalizePricingEntry(entry);
      if (pricing) {
        table[name] = pricing;
      }
    }
    return Object.keys(table).length > 0 ? table : null;
  } catch {
    return null;
  }
}

function defaultDeps(): ResolvePricingDeps {
  return {
    now: () => Date.now(),
    ttlMs: PRICING_TTL_MS,
    readCache: () => readPricingCache(),
    writeCache: (table, now) => writePricingCache(table, now),
    fetchTable: () => fetchLiteLLMTable(),
    embedded: EMBEDDED_PRICING,
  };
}

/**
 * Resolve pricing. A fresh cache short-circuits the network; a successful
 * fetch refreshes the cache; if both are unavailable, the embedded snapshot is
 * returned. Cache write failures are ignored.
 */
export async function resolvePricing(
  overrides: Partial<ResolvePricingDeps> = {},
): Promise<ResolvedPricing> {
  const deps = { ...defaultDeps(), ...overrides };

  const cached = await deps.readCache();
  if (cached && deps.now() - cached.fetchedAt < deps.ttlMs) {
    return { table: cached.table, source: 'cache' };
  }

  const fetched = await deps.fetchTable();
  if (fetched) {
    await deps.writeCache(fetched, deps.now());
    return { table: fetched, source: 'network' };
  }

  // Stale cache still beats the embedded snapshot when the network is down.
  if (cached) {
    return { table: cached.table, source: 'cache' };
  }

  return { table: deps.embedded, source: 'embedded' };
}

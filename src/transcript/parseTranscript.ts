/**
 * Pure transcript parsing. A Claude Code transcript is JSONL; assistant
 * message lines carry `message.model` + `message.usage`, from which we sum a
 * precise running cost and cumulative token counts. `compact_boundary` events
 * are counted but never reset the cost — that spend already happened. The
 * live context size tracks the most recent assistant message, which is
 * naturally post-compaction.
 */
import { calculateCost } from '../pricing/calculateCost.js';
import type { PricingTable, TokenUsage } from '../types/Pricing.js';

/** Prompt-cache TTL windows: the default 5-minute cache and the extended 1-hour cache. */
const CACHE_TTL_5M_MS = 5 * 60 * 1000;
const CACHE_TTL_1H_MS = 60 * 60 * 1000;

export interface TranscriptTotals {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  compactions: number;
  /** Tokens in the current context window (last assistant message). */
  contextTokens: number;
  /**
   * Epoch ms when the most recently written prompt cache expires, or null when
   * no cache-creating message carried a parseable timestamp. Absolute, so it
   * survives incremental caching and the widget just compares it to "now".
   */
  cacheExpiresAt: number | null;
  /**
   * TTL of the most recently written prompt cache in ms (5m or 1h tier), or
   * null before any cache-creating message. The next-cost projection uses the
   * tier to price a cache rebuild; unlike `cacheExpiresAt` it needs no
   * timestamp, so a tier is known as soon as a cache-creating message appears.
   */
  cacheTtlMs: number | null;
}

export interface ParseResult extends Omit<
  TranscriptTotals,
  'contextTokens' | 'cacheExpiresAt' | 'cacheTtlMs'
> {
  /** Context size of the last assistant message in this chunk, or null. */
  lastContextTokens: number | null;
  /** Cache expiry from the last cache-creating message in this chunk, or null. */
  lastCacheExpiresAt: number | null;
  /** Cache TTL tier from the last cache-creating message in this chunk, or null. */
  lastCacheTtlMs: number | null;
}

export const ZERO_TOTALS: TranscriptTotals = {
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  compactions: 0,
  contextTokens: 0,
  cacheExpiresAt: null,
  cacheTtlMs: null,
};

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function isCompaction(entry: Record<string, unknown>): boolean {
  return (
    (entry.type === 'system' && entry.subtype === 'compact_boundary') ||
    entry.isCompactSummary === true ||
    entry.type === 'summary'
  );
}

function extractUsage(usage: Record<string, unknown>): {
  usage: TokenUsage;
  cacheCreationTotal: number;
} {
  const breakdownRaw = usage.cache_creation as
    Record<string, unknown> | undefined;
  const breakdown = breakdownRaw
    ? {
        ephemeral5mInputTokens: num(breakdownRaw.ephemeral_5m_input_tokens),
        ephemeral1hInputTokens: num(breakdownRaw.ephemeral_1h_input_tokens),
      }
    : undefined;
  const flatCacheCreation = num(usage.cache_creation_input_tokens);
  const tokenUsage: TokenUsage = {
    inputTokens: num(usage.input_tokens),
    outputTokens: num(usage.output_tokens),
    cacheReadInputTokens: num(usage.cache_read_input_tokens),
    cacheCreationInputTokens: flatCacheCreation,
    cacheCreation: breakdown,
  };
  const cacheCreationTotal = breakdown
    ? breakdown.ephemeral5mInputTokens + breakdown.ephemeral1hInputTokens
    : flatCacheCreation;
  return { usage: tokenUsage, cacheCreationTotal };
}

/** Parse a whole (or complete-line prefix) transcript text into a delta. */
export function parseTranscript(
  text: string,
  pricing: PricingTable,
): ParseResult {
  const result: ParseResult = {
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    compactions: 0,
    lastContextTokens: null,
    lastCacheExpiresAt: null,
    lastCacheTtlMs: null,
  };

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue; // tolerate a corrupt or partial line
    }

    if (isCompaction(entry)) {
      result.compactions += 1;
      continue;
    }

    const message = entry.message as Record<string, unknown> | undefined;
    const usageRaw = message?.usage as Record<string, unknown> | undefined;
    if (!message || !usageRaw) {
      continue;
    }

    const model = typeof message.model === 'string' ? message.model : undefined;
    const { usage, cacheCreationTotal } = extractUsage(usageRaw);

    result.costUsd += calculateCost(model, usage, pricing);
    result.inputTokens += usage.inputTokens;
    result.outputTokens += usage.outputTokens;
    result.cacheReadTokens += usage.cacheReadInputTokens;
    result.cacheCreationTokens += cacheCreationTotal;
    result.lastContextTokens =
      usage.inputTokens + usage.cacheReadInputTokens + cacheCreationTotal;

    // Only a cache-*creating* message reveals the cache tier and, given a
    // timestamp, when the fresh cache expires; a plain cache read tells us
    // neither. The tier is known without a timestamp, the expiry is not.
    if (cacheCreationTotal > 0) {
      const ttl =
        (usage.cacheCreation?.ephemeral1hInputTokens ?? 0) > 0
          ? CACHE_TTL_1H_MS
          : CACHE_TTL_5M_MS;
      result.lastCacheTtlMs = ttl;
      const ts =
        typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN;
      if (Number.isFinite(ts)) {
        result.lastCacheExpiresAt = ts + ttl;
      }
    }
  }

  return result;
}

/** Fold a parse delta into running totals. */
export function mergeTotals(
  prev: TranscriptTotals,
  delta: ParseResult,
): TranscriptTotals {
  return {
    costUsd: prev.costUsd + delta.costUsd,
    inputTokens: prev.inputTokens + delta.inputTokens,
    outputTokens: prev.outputTokens + delta.outputTokens,
    cacheReadTokens: prev.cacheReadTokens + delta.cacheReadTokens,
    cacheCreationTokens: prev.cacheCreationTokens + delta.cacheCreationTokens,
    compactions: prev.compactions + delta.compactions,
    contextTokens: delta.lastContextTokens ?? prev.contextTokens,
    cacheExpiresAt: delta.lastCacheExpiresAt ?? prev.cacheExpiresAt,
    cacheTtlMs: delta.lastCacheTtlMs ?? prev.cacheTtlMs,
  };
}

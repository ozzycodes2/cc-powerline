/**
 * Pricing model shapes, ported from ccusage-core (`rust/crates/ccusage-core`).
 *
 * `ModelPricing` is the resolved, per-token representation the cost calculator
 * consumes. `RawLiteLLMEntry` is the subset of a LiteLLM
 * `model_prices_and_context_window.json` record we read before normalizing it
 * into a `ModelPricing`.
 */

/** Per-token rates for one model, already normalized (defaults applied). */
export interface ModelPricing {
  /** input_cost_per_token */
  input: number;
  /** output_cost_per_token */
  output: number;
  /** cache_creation_input_token_cost — the 5-minute-TTL creation rate. */
  cacheCreate: number;
  /** cache_read_input_token_cost */
  cacheRead: number;
  /** input_cost_per_token_above_200k_tokens */
  inputAbove200k?: number;
  /** output_cost_per_token_above_200k_tokens */
  outputAbove200k?: number;
  /** cache_creation_input_token_cost_above_200k_tokens */
  cacheCreateAbove200k?: number;
  /** cache_read_input_token_cost_above_200k_tokens */
  cacheReadAbove200k?: number;
  /**
   * When set, the WHOLE request is billed at one tier (all-or-nothing) chosen
   * by whether the summed context exceeds this threshold. When unset, each
   * bucket tiers independently at the default 200k boundary.
   */
  longContextThreshold?: number;
}

/** Map of model name → resolved pricing. */
export type PricingTable = Record<string, ModelPricing>;

/** The token buckets for a single usage entry (Claude message-usage shape). */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  /** Flat cache-creation count, used only when `cacheCreation` is absent. */
  cacheCreationInputTokens: number;
  /** 5m/1h split, when the transcript provides the breakdown. */
  cacheCreation?: {
    ephemeral5mInputTokens: number;
    ephemeral1hInputTokens: number;
  };
}

/** Subset of a LiteLLM pricing record we care about. */
export interface RawLiteLLMEntry {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_creation_input_token_cost?: number;
  cache_read_input_token_cost?: number;
  input_cost_per_token_above_200k_tokens?: number;
  output_cost_per_token_above_200k_tokens?: number;
  cache_creation_input_token_cost_above_200k_tokens?: number;
  cache_read_input_token_cost_above_200k_tokens?: number;
  litellm_provider?: string;
}

export const CACHE_CREATE_1H_INPUT_MULTIPLIER = 2.0;
export const DEFAULT_LONG_CONTEXT_THRESHOLD_TOKENS = 200_000;

/** Default cache-creation rate when a model omits it (input × 1.25). */
export const DEFAULT_CACHE_CREATE_MULTIPLIER = 1.25;
/** Default cache-read rate when a model omits it (input × 0.1). */
export const DEFAULT_CACHE_READ_MULTIPLIER = 0.1;

/**
 * Normalize a raw LiteLLM record into `ModelPricing`, applying ccusage's
 * missing-rate defaults. Returns `null` when the entry has no input rate — a
 * model we cannot price at all.
 */
export function normalizePricingEntry(raw: RawLiteLLMEntry): ModelPricing | null {
  const input = raw.input_cost_per_token;
  if (typeof input !== 'number') {
    return null;
  }
  return {
    input,
    output: raw.output_cost_per_token ?? 0,
    cacheCreate:
      raw.cache_creation_input_token_cost ?? input * DEFAULT_CACHE_CREATE_MULTIPLIER,
    cacheRead: raw.cache_read_input_token_cost ?? input * DEFAULT_CACHE_READ_MULTIPLIER,
    inputAbove200k: raw.input_cost_per_token_above_200k_tokens,
    outputAbove200k: raw.output_cost_per_token_above_200k_tokens,
    cacheCreateAbove200k: raw.cache_creation_input_token_cost_above_200k_tokens,
    cacheReadAbove200k: raw.cache_read_input_token_cost_above_200k_tokens,
  };
}

/**
 * Cost calculation — a faithful port of ccusage-core's `calculate_cost_from_*`
 * (`rust/crates/ccusage-core/src/cost.rs`). Pure arithmetic, f64 throughout,
 * no rounding (callers round only at display).
 */
import {
  CACHE_CREATE_1H_INPUT_MULTIPLIER,
  DEFAULT_LONG_CONTEXT_THRESHOLD_TOKENS,
  type ModelPricing,
  type PricingTable,
  type TokenUsage,
} from '../types/Pricing.js';

/**
 * Marginal tiered cost at a fixed boundary: tokens below `threshold` bill at
 * `base`, the remainder at `above` (falling back to `base` when no above-rate
 * exists). Mirrors ccusage's `tiered_cost`.
 */
export function tieredCost(
  tokens: number,
  base: number,
  above: number | undefined,
  threshold: number,
): number {
  if (tokens === 0) {
    return 0;
  }
  if (above !== undefined && tokens > threshold) {
    return threshold * base + (tokens - threshold) * above;
  }
  return tokens * base;
}

/** Split a usage entry into (5m, 1h) cache-creation token counts. */
function cacheCreationSplit(usage: TokenUsage): [number, number] {
  if (usage.cacheCreation) {
    return [
      usage.cacheCreation.ephemeral5mInputTokens,
      usage.cacheCreation.ephemeral1hInputTokens,
    ];
  }
  return [usage.cacheCreationInputTokens, 0];
}

/** Cost of a single usage entry against one model's resolved pricing. */
export function calculateCostFromPricing(usage: TokenUsage, pricing: ModelPricing): number {
  const [cacheCreate5m, cacheCreate1h] = cacheCreationSplit(usage);

  // The 1h cache-creation rate is derived from the input rate, not configured.
  const cacheCreate1hCost = pricing.input * CACHE_CREATE_1H_INPUT_MULTIPLIER;
  const cacheCreate1hCostAbove200k =
    pricing.inputAbove200k === undefined
      ? undefined
      : pricing.inputAbove200k * CACHE_CREATE_1H_INPUT_MULTIPLIER;

  // Two-stage (all-or-nothing) tiering: a model-level threshold selects a
  // single tier for the entire request based on the summed context size.
  if (pricing.longContextThreshold !== undefined) {
    const contextTokens =
      usage.inputTokens +
      usage.cacheReadInputTokens +
      cacheCreate5m +
      cacheCreate1h;
    const longContext = contextTokens > pricing.longContextThreshold;
    const rate = (base: number, above: number | undefined): number =>
      longContext ? (above ?? base) : base;

    return (
      usage.inputTokens * rate(pricing.input, pricing.inputAbove200k) +
      usage.outputTokens * rate(pricing.output, pricing.outputAbove200k) +
      cacheCreate5m * rate(pricing.cacheCreate, pricing.cacheCreateAbove200k) +
      cacheCreate1h * rate(cacheCreate1hCost, cacheCreate1hCostAbove200k) +
      usage.cacheReadInputTokens * rate(pricing.cacheRead, pricing.cacheReadAbove200k)
    );
  }

  // Default path: each bucket tiers independently at the 200k boundary.
  const threshold = DEFAULT_LONG_CONTEXT_THRESHOLD_TOKENS;
  return (
    tieredCost(usage.inputTokens, pricing.input, pricing.inputAbove200k, threshold) +
    tieredCost(usage.outputTokens, pricing.output, pricing.outputAbove200k, threshold) +
    tieredCost(cacheCreate5m, pricing.cacheCreate, pricing.cacheCreateAbove200k, threshold) +
    tieredCost(cacheCreate1h, cacheCreate1hCost, cacheCreate1hCostAbove200k, threshold) +
    tieredCost(usage.cacheReadInputTokens, pricing.cacheRead, pricing.cacheReadAbove200k, threshold)
  );
}

/**
 * Cost of a usage entry for `model` against a pricing table. An unknown model
 * (or missing model name) costs exactly `0` — silent, matching ccusage.
 */
export function calculateCost(
  model: string | undefined,
  usage: TokenUsage,
  table: PricingTable,
): number {
  if (!model) {
    return 0;
  }
  const pricing = table[model];
  if (!pricing) {
    return 0;
  }
  return calculateCostFromPricing(usage, pricing);
}

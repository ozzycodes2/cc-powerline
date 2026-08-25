import { describe, it, expect } from 'vitest';
import { calculateCost, tieredCost } from '../../src/pricing/calculateCost.js';
import {
  normalizePricingEntry,
  type PricingTable,
  type TokenUsage,
} from '../../src/types/Pricing.js';

/** The inline `test-model` pricing from ccusage cost.rs `#[cfg(test)]`. */
const TEST_TABLE: PricingTable = {
  'test-model': {
    input: 1.0,
    output: 10.0,
    cacheCreate: 1.25,
    cacheRead: 0.1,
    inputAbove200k: 2.0,
    cacheCreateAbove200k: 1.5,
  },
};

/** gpt-5.6-sol: 272k all-or-nothing threshold, short/long rates per 1M. */
const GPT56_TABLE: PricingTable = {
  'gpt-5.6-sol': {
    input: 5e-6,
    output: 30e-6,
    cacheCreate: 5e-6 * 1.25,
    cacheRead: 0.5e-6,
    inputAbove200k: 10e-6,
    outputAbove200k: 45e-6,
    cacheReadAbove200k: 1e-6,
    longContextThreshold: 272_000,
  },
};

/** grok-4.5: 200k all-or-nothing threshold. */
const GROK_TABLE: PricingTable = {
  'grok-4.5': {
    input: 2e-6,
    output: 6e-6,
    cacheCreate: 2e-6 * 1.25,
    cacheRead: 0.3e-6,
    inputAbove200k: 4e-6,
    outputAbove200k: 12e-6,
    cacheReadAbove200k: 0.6e-6,
    longContextThreshold: 200_000,
  },
};

function usage(partial: Partial<TokenUsage>): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    ...partial,
  };
}

describe('calculateCost — ccusage golden vectors', () => {
  it('prices a 5m/1h cache-creation breakdown (→ 55.5)', () => {
    const cost = calculateCost(
      'test-model',
      usage({
        cacheCreationInputTokens: 999, // ignored because a breakdown is present
        cacheReadInputTokens: 30,
        cacheCreation: {
          ephemeral5mInputTokens: 10,
          ephemeral1hInputTokens: 20,
        },
      }),
      TEST_TABLE,
    );
    expect(Math.abs(cost - 55.5)).toBeLessThan(Number.EPSILON);
  });

  it('falls back to the flat cache-creation rate without a breakdown (→ 12.5)', () => {
    const cost = calculateCost(
      'test-model',
      usage({ cacheCreationInputTokens: 10 }),
      TEST_TABLE,
    );
    expect(Math.abs(cost - 12.5)).toBeLessThan(Number.EPSILON);
  });

  it('prices a two-stage model as a whole request at long-context rates (→ 3.0451)', () => {
    const cost = calculateCost(
      'gpt-5.6-sol',
      usage({
        inputTokens: 300_000,
        outputTokens: 1_000,
        cacheReadInputTokens: 100,
      }),
      GPT56_TABLE,
    );
    expect(Math.abs(cost - 3.0451)).toBeLessThan(1e-9);
  });

  it('prices the same two-stage model below threshold at short rates (→ 0.53005)', () => {
    const cost = calculateCost(
      'gpt-5.6-sol',
      usage({
        inputTokens: 100_000,
        outputTokens: 1_000,
        cacheReadInputTokens: 100,
      }),
      GPT56_TABLE,
    );
    expect(Math.abs(cost - 0.53005)).toBeLessThan(1e-9);
  });

  it('lets cache reads alone push a request into the long-context tier (→ 0.352)', () => {
    const cost = calculateCost(
      'grok-4.5',
      usage({
        inputTokens: 10_000,
        outputTokens: 1_000,
        cacheReadInputTokens: 500_000,
      }),
      GROK_TABLE,
    );
    expect(Math.abs(cost - 0.352)).toBeLessThan(1e-9);
  });

  it('keeps the same shape on base rates below the boundary (→ 0.056)', () => {
    const cost = calculateCost(
      'grok-4.5',
      usage({
        inputTokens: 10_000,
        outputTokens: 1_000,
        cacheReadInputTokens: 100_000,
      }),
      GROK_TABLE,
    );
    expect(Math.abs(cost - 0.056)).toBeLessThan(1e-9);
  });
});

describe('calculateCost — edge cases', () => {
  it('returns 0 for an unknown model', () => {
    expect(
      calculateCost('nope', usage({ inputTokens: 1000 }), TEST_TABLE),
    ).toBe(0);
  });

  it('returns 0 for a missing model name', () => {
    expect(
      calculateCost(undefined, usage({ inputTokens: 1000 }), TEST_TABLE),
    ).toBe(0);
  });

  it('returns 0 for an all-zero usage entry', () => {
    expect(calculateCost('test-model', usage({}), TEST_TABLE)).toBe(0);
  });
});

describe('normalizePricingEntry — missing-rate defaults', () => {
  it('defaults cache_create to input×1.25 and cache_read to input×0.1', () => {
    const p = normalizePricingEntry({
      input_cost_per_token: 4,
      output_cost_per_token: 20,
    });
    expect(p).not.toBeNull();
    expect(p!.cacheCreate).toBeCloseTo(5.0, 12); // 4 × 1.25
    expect(p!.cacheRead).toBeCloseTo(0.4, 12); // 4 × 0.1
    expect(p!.output).toBe(20);
  });

  it('keeps explicit rates when present', () => {
    const p = normalizePricingEntry({
      input_cost_per_token: 4,
      cache_creation_input_token_cost: 9,
      cache_read_input_token_cost: 1,
    });
    expect(p!.cacheCreate).toBe(9);
    expect(p!.cacheRead).toBe(1);
  });

  it('returns null when there is no input rate to price against', () => {
    expect(normalizePricingEntry({ output_cost_per_token: 20 })).toBeNull();
  });
});

describe('tieredCost', () => {
  it('is 0 for 0 tokens', () => {
    expect(tieredCost(0, 5, 10, 200_000)).toBe(0);
  });

  it('bills entirely at base below the threshold', () => {
    expect(tieredCost(100, 2, 5, 200)).toBe(200);
  });

  it('bills the remainder at the above-rate past the threshold', () => {
    expect(tieredCost(300, 2, 5, 200)).toBe(200 * 2 + 100 * 5);
  });

  it('falls back to base when no above-rate exists', () => {
    expect(tieredCost(300, 2, undefined, 200)).toBe(600);
  });
});

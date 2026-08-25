import { describe, it, expect } from 'vitest';
import { parseStatusJSON } from '../../src/types/StatusJSON.js';

describe('parseStatusJSON', () => {
  it('parses a well-formed payload', () => {
    const s = parseStatusJSON(
      JSON.stringify({
        model: { id: 'claude-opus-4-8', display_name: 'Opus 4.8' },
        cwd: '/home/x/proj',
        cost: { total_cost_usd: 1.23 },
        context_window: { used_percentage: 42 },
      }),
    );
    expect(s.model?.display_name).toBe('Opus 4.8');
    expect(s.cost?.total_cost_usd).toBe(1.23);
    expect(s.context_window?.used_percentage).toBe(42);
  });

  it('returns {} for non-JSON input', () => {
    expect(parseStatusJSON('not json')).toEqual({});
  });

  it('preserves unknown top-level keys (passthrough)', () => {
    const s = parseStatusJSON(JSON.stringify({ brand_new_field: 7 })) as Record<
      string,
      unknown
    >;
    expect(s.brand_new_field).toBe(7);
  });

  it('degrades a single mis-typed field to undefined without dropping the rest', () => {
    const s = parseStatusJSON(
      JSON.stringify({ cwd: '/x', cost: { total_cost_usd: 'oops' } }),
    );
    expect(s.cwd).toBe('/x');
    expect(s.cost?.total_cost_usd).toBeUndefined();
  });
});

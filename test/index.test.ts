import { describe, it, expect } from 'vitest';
import { renderStatusline, type StatuslineDeps } from '../src/index.js';
import { stripAnsi } from '../src/render/stripAnsi.js';
import { ZERO_TOTALS } from '../src/transcript/parseTranscript.js';
import type { PricingTable } from '../src/types/Pricing.js';
import type { Settings } from '../src/types/Settings.js';

const TABLE: PricingTable = { m: { input: 1e-6, output: 2e-6, cacheCreate: 1e-6, cacheRead: 1e-7 } };

const builtinModel: Settings = {
  style: 'builtin',
  lines: [{ left: [{ type: 'model' }], right: [] }],
};

function deps(over: Partial<StatuslineDeps> = {}): StatuslineDeps {
  return {
    resolvePricing: async () => TABLE,
    loadSettings: async () => ({ settings: builtinModel, warnings: [] }),
    loadTotals: async () => ZERO_TOTALS,
    resolveBranch: () => null,
    resolveChanges: () => null,
    now: () => 0,
    home: () => '',
    width: () => 80,
    warn: () => {},
    ...over,
  };
}

describe('renderStatusline', () => {
  it('renders a line from stdin JSON', async () => {
    const input = JSON.stringify({ model: { display_name: 'Opus' } });
    const out = stripAnsi(await renderStatusline(input, deps()));
    expect(out).toContain('Opus');
  });

  it('forwards settings warnings to the warn sink', async () => {
    const warnings: string[] = [];
    await renderStatusline('{}', deps({
      loadSettings: async () => ({ settings: builtinModel, warnings: ['heads up'] }),
      warn: (m) => warnings.push(m),
    }));
    expect(warnings).toEqual(['heads up']);
  });

  it('passes the transcript path through to loadTotals', async () => {
    let seen: string | undefined = 'unset';
    await renderStatusline(JSON.stringify({ transcript_path: '/t.jsonl' }), deps({
      loadTotals: async (path) => {
        seen = path;
        return ZERO_TOTALS;
      },
    }));
    expect(seen).toBe('/t.jsonl');
  });

  it('degrades to zero totals when loadTotals throws', async () => {
    const settings: Settings = { style: 'builtin', lines: [{ left: [{ type: 'session-cost' }], right: [] }] };
    const out = stripAnsi(await renderStatusline('{}', deps({
      loadSettings: async () => ({ settings, warnings: [] }),
      loadTotals: async () => {
        throw new Error('bad transcript');
      },
    })));
    expect(out).toContain('$0.00');
  });

  it('never throws — returns empty string when a dependency explodes', async () => {
    const out = await renderStatusline('{}', deps({
      resolvePricing: async () => {
        throw new Error('network down');
      },
    }));
    expect(out).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { renderWidget, WIDGET_TYPES } from '../../src/widgets/registry.js';
import {
  ZERO_TOTALS,
  type TranscriptTotals,
} from '../../src/transcript/parseTranscript.js';
import type { WidgetContext } from '../../src/widgets/Widget.js';
import type { StatusJSON } from '../../src/types/StatusJSON.js';

function ctx(over: {
  status?: StatusJSON;
  totals?: Partial<TranscriptTotals>;
  branch?: string | null;
  changes?: { added: number; deleted: number } | null;
  worktree?: boolean;
  now?: number;
  home?: string;
}): WidgetContext {
  return {
    status: over.status ?? {},
    totals: { ...ZERO_TOTALS, ...over.totals },
    git: {
      branch: over.branch ?? null,
      changes: over.changes ?? null,
      worktree: over.worktree,
    },
    now: over.now,
    home: over.home,
  };
}

describe('renderWidget', () => {
  it('exposes exactly the widget set', () => {
    expect(WIDGET_TYPES).toEqual([
      'model',
      'model-effort',
      'git-branch',
      'git-changes',
      'directory',
      'context-length',
      'session-cost',
      'next-cost',
      'cache-hit-rate',
      'total-tokens',
      'cache-window',
      'compactions',
      'rate-limit',
      'separator',
    ]);
  });

  it('returns null for an unknown widget type', () => {
    expect(renderWidget('nope', ctx({}))).toBeNull();
  });

  describe('model', () => {
    it('prefers display_name, falls back to id, then null', () => {
      expect(
        renderWidget(
          'model',
          ctx({ status: { model: { display_name: 'Opus' } } }),
        ),
      ).toBe('Opus');
      expect(
        renderWidget('model', ctx({ status: { model: { id: 'claude-x' } } })),
      ).toBe('claude-x');
      expect(renderWidget('model', ctx({ status: { model: {} } }))).toBeNull();
    });
  });

  describe('git-branch', () => {
    it('renders a plain branch with the default branch glyph, and hides when absent', () => {
      // Default icon is a nerd-font branch glyph, so the branch trails a "<glyph> " prefix.
      expect(renderWidget('git-branch', ctx({ branch: 'feature/x' }))).toMatch(
        / feature\/x$/,
      );
      expect(
        renderWidget('git-branch', ctx({ branch: 'feature/x' }), { icon: '⎇' }),
      ).toBe('⎇ feature/x');
      expect(
        renderWidget('git-branch', ctx({ branch: 'feature/x' }), { icon: '' }),
      ).toBe('feature/x');
      expect(renderWidget('git-branch', ctx({ branch: null }))).toBeNull();
    });

    it('uses the main icon on main/master', () => {
      expect(
        renderWidget('git-branch', ctx({ branch: 'main' }), { mainIcon: '★' }),
      ).toBe('★ main');
      expect(
        renderWidget('git-branch', ctx({ branch: 'master' }), {
          mainIcon: '★',
        }),
      ).toBe('★ master');
      // The main icon is chosen over the plain branch icon, not appended to it.
      expect(
        renderWidget('git-branch', ctx({ branch: 'main' }), {
          icon: '⎇',
          mainIcon: '★',
        }),
      ).toBe('★ main');
    });

    it('uses the worktree icon in a linked worktree, even on main', () => {
      expect(
        renderWidget(
          'git-branch',
          ctx({ branch: 'feature/x', worktree: true }),
          {
            worktreeIcon: '⑂',
          },
        ),
      ).toBe('⑂ feature/x');
      // Worktree wins over the main-branch icon.
      expect(
        renderWidget('git-branch', ctx({ branch: 'main', worktree: true }), {
          mainIcon: '★',
          worktreeIcon: '⑂',
        }),
      ).toBe('⑂ main');
    });

    it('drops the prefix entirely when the chosen icon is empty', () => {
      expect(
        renderWidget('git-branch', ctx({ branch: 'main' }), { mainIcon: '' }),
      ).toBe('main');
      expect(
        renderWidget('git-branch', ctx({ branch: 'x', worktree: true }), {
          worktreeIcon: '',
        }),
      ).toBe('x');
    });
  });

  describe('model-effort', () => {
    it('renders the bare effort level (no icon), hides when absent', () => {
      expect(
        renderWidget(
          'model-effort',
          ctx({ status: { effort: { level: 'high' } } }),
        ),
      ).toBe('high');
      expect(
        renderWidget(
          'model-effort',
          ctx({ status: { effort: { level: 'low' } } }),
        ),
      ).toBe('low');
      expect(
        renderWidget(
          'model-effort',
          ctx({ status: { effort: { level: '' } } }),
        ),
      ).toBeNull();
      expect(renderWidget('model-effort', ctx({}))).toBeNull();
    });
  });

  describe('directory', () => {
    it('compresses the full path powerline-style by default', () => {
      expect(
        renderWidget('directory', ctx({ status: { cwd: '/aa/bb/proj' } })),
      ).toBe('/a/b/proj');
    });

    it('substitutes ~ for the home directory', () => {
      expect(
        renderWidget(
          'directory',
          ctx({
            status: { cwd: '/home/me/Documents/work/proj' },
            home: '/home/me',
          }),
        ),
      ).toBe('~/D/w/proj');
    });

    it('honors basename and full modes, and hides when there is no dir', () => {
      expect(
        renderWidget('directory', ctx({ status: { cwd: '/a/b/proj' } }), {
          mode: 'basename',
        }),
      ).toBe('proj');
      expect(
        renderWidget('directory', ctx({ status: { cwd: '/a/b/proj' } }), {
          mode: 'full',
        }),
      ).toBe('/a/b/proj');
      expect(renderWidget('directory', ctx({}))).toBeNull();
    });
  });

  describe('git-changes', () => {
    it('shows +added -deleted, hides when clean or absent', () => {
      expect(
        renderWidget(
          'git-changes',
          ctx({ changes: { added: 12, deleted: 3 } }),
          { icon: '' },
        ),
      ).toBe('+12 -3');
      expect(
        renderWidget(
          'git-changes',
          ctx({ changes: { added: 1, deleted: 0 } }),
          { icon: 'Δ' },
        ),
      ).toBe('Δ +1 -0');
      expect(
        renderWidget('git-changes', ctx({ changes: { added: 0, deleted: 0 } })),
      ).toBeNull();
      expect(renderWidget('git-changes', ctx({}))).toBeNull();
    });
  });

  describe('context-length', () => {
    it('uses used_percentage directly with a leading icon', () => {
      expect(
        renderWidget(
          'context-length',
          ctx({ status: { context_window: { used_percentage: 42 } } }),
          { label: 'ctx' },
        ),
      ).toBe('ctx 42%');
    });

    it('derives a percentage from context_window_size, and drops the label when empty', () => {
      expect(
        renderWidget(
          'context-length',
          ctx({
            status: { context_window: { context_window_size: 200 } },
            totals: { contextTokens: 100 },
          }),
          { label: '' },
        ),
      ).toBe('50%');
    });

    it('hides when there is nothing to compute from', () => {
      expect(renderWidget('context-length', ctx({}))).toBeNull();
    });
  });

  describe('cache-window', () => {
    it('counts down to cache expiry, hides when expired or unknown', () => {
      expect(
        renderWidget(
          'cache-window',
          ctx({ totals: { cacheExpiresAt: 300_000 }, now: 60_000 }),
          { icon: '' },
        ),
      ).toBe('4:00');
      // expired
      expect(
        renderWidget(
          'cache-window',
          ctx({ totals: { cacheExpiresAt: 1000 }, now: 2000 }),
        ),
      ).toBeNull();
      // no expiry recorded
      expect(renderWidget('cache-window', ctx({ now: 1000 }))).toBeNull();
      // no clock injected
      expect(
        renderWidget(
          'cache-window',
          ctx({ totals: { cacheExpiresAt: 300_000 } }),
        ),
      ).toBeNull();
    });
  });

  describe('compactions', () => {
    it('shows the count, hides at zero', () => {
      expect(
        renderWidget('compactions', ctx({ totals: { compactions: 2 } }), {
          icon: '',
        }),
      ).toBe('2');
      expect(
        renderWidget('compactions', ctx({ totals: { compactions: 1 } }), {
          icon: 'C',
        }),
      ).toBe('C 1');
      expect(
        renderWidget('compactions', ctx({ totals: { compactions: 0 } })),
      ).toBeNull();
    });
  });

  describe('session-cost', () => {
    it('prefers transcript cost, else falls back to reported cost', () => {
      expect(
        renderWidget('session-cost', ctx({ totals: { costUsd: 0.5 } })),
      ).toBe('$0.5000');
      expect(
        renderWidget(
          'session-cost',
          ctx({ status: { cost: { total_cost_usd: 2 } } }),
        ),
      ).toBe('$2.00');
      expect(renderWidget('session-cost', ctx({}))).toBe('$0.00');
    });
  });

  describe('next-cost', () => {
    // 200k context on Opus ($5/MTok): warm = 0.2 * 5 * 0.1 = $0.10;
    // cold 5m = 0.2 * 5 * 1.25 = $1.25; cold 1h = 0.2 * 5 * 2 = $2.00.
    const opus = { model: { display_name: 'Opus 4.8' } };

    it('projects warm→cold, pricing the rebuild by the cache tier', () => {
      expect(
        renderWidget(
          'next-cost',
          ctx({
            status: opus,
            totals: { contextTokens: 200_000, cacheTtlMs: 300_000 },
          }),
        ),
      ).toBe('10¢→$1.25');
      expect(
        renderWidget(
          'next-cost',
          ctx({
            status: opus,
            totals: { contextTokens: 200_000, cacheTtlMs: 3_600_000 },
          }),
        ),
      ).toBe('10¢→$2.00');
    });

    it('prices each model family by its base input rate', () => {
      // 200k @ 5m tier, warm = tokens/1e6 * base * 0.1, cold = * 1.25.
      const at = (display_name: string) =>
        renderWidget(
          'next-cost',
          ctx({
            status: { model: { display_name } },
            totals: { contextTokens: 200_000, cacheTtlMs: 300_000 },
          }),
        );
      expect(at('Fable 5')).toBe('20¢→$2.50'); // $10/MTok
      expect(at('Sonnet 5')).toBe('6¢→75¢'); // $3/MTok
      expect(at('Haiku 4.5')).toBe('2¢→25¢'); // $1/MTok
    });

    it('defaults an unknown tier to the cheaper 5-minute rebuild rate', () => {
      expect(
        renderWidget(
          'next-cost',
          ctx({ status: opus, totals: { contextTokens: 200_000 } }),
        ),
      ).toBe('10¢→$1.25');
    });

    it('collapses to the rebuild cost alone once the cache is cold', () => {
      // now past expiry → warm price is gone, only the cold figure remains.
      expect(
        renderWidget(
          'next-cost',
          ctx({
            status: opus,
            totals: {
              contextTokens: 200_000,
              cacheTtlMs: 300_000,
              cacheExpiresAt: 1000,
            },
            now: 2000,
          }),
        ),
      ).toBe('$1.25');
      // still warm (now before expiry) → both figures.
      expect(
        renderWidget(
          'next-cost',
          ctx({
            status: opus,
            totals: {
              contextTokens: 200_000,
              cacheTtlMs: 300_000,
              cacheExpiresAt: 5000,
            },
            now: 2000,
          }),
        ),
      ).toBe('10¢→$1.25');
      // expiry known but no clock → assume warm, show the pair.
      expect(
        renderWidget(
          'next-cost',
          ctx({
            status: opus,
            totals: {
              contextTokens: 200_000,
              cacheTtlMs: 300_000,
              cacheExpiresAt: 1000,
            },
          }),
        ),
      ).toBe('10¢→$1.25');
    });

    it('honors a configured icon', () => {
      expect(
        renderWidget(
          'next-cost',
          ctx({
            status: opus,
            totals: { contextTokens: 200_000, cacheTtlMs: 300_000 },
          }),
          { icon: '$' },
        ),
      ).toBe('$ 10¢→$1.25');
    });

    it('hides for an unknown model family or an empty context', () => {
      expect(
        renderWidget(
          'next-cost',
          ctx({
            status: { model: { display_name: 'Gemini' } },
            totals: { contextTokens: 200_000 },
          }),
        ),
      ).toBeNull();
      expect(
        renderWidget(
          'next-cost',
          ctx({ status: opus, totals: { contextTokens: 0 } }),
        ),
      ).toBeNull();
      expect(
        renderWidget('next-cost', ctx({ totals: { contextTokens: 200_000 } })),
      ).toBeNull();
    });
  });

  describe('cache-hit-rate', () => {
    it('is the read share of all cache tokens, hidden when there are none', () => {
      expect(
        renderWidget(
          'cache-hit-rate',
          ctx({ totals: { cacheReadTokens: 3, cacheCreationTokens: 1 } }),
        ),
      ).toBe('\u{f1c0} 75%');
      expect(renderWidget('cache-hit-rate', ctx({}))).toBeNull();
    });
  });

  describe('total-tokens', () => {
    it('sums input, output, and both cache streams, hidden at zero', () => {
      expect(
        renderWidget(
          'total-tokens',
          ctx({
            totals: {
              inputTokens: 12_000,
              outputTokens: 3400,
              cacheReadTokens: 60_000,
              cacheCreationTokens: 9000,
            },
          }),
          { icon: '' },
        ),
      ).toBe('84.4k');
      // default glyph prefixes the count
      expect(
        renderWidget('total-tokens', ctx({ totals: { outputTokens: 500 } }), {
          icon: 'T',
        }),
      ).toBe('T 500');
      expect(renderWidget('total-tokens', ctx({}))).toBeNull();
    });
  });

  describe('rate-limit', () => {
    it('shows the 5h usage percentage or hides it', () => {
      expect(
        renderWidget(
          'rate-limit',
          ctx({
            status: { rate_limits: { five_hour: { used_percentage: 12 } } },
          }),
        ),
      ).toBe('5h:12%');
      expect(renderWidget('rate-limit', ctx({}))).toBeNull();
    });
  });

  describe('separator', () => {
    it('renders the configured char, defaulting to a pipe', () => {
      expect(renderWidget('separator', ctx({}))).toBe('|');
      expect(renderWidget('separator', ctx({}), { char: '::' })).toBe('::');
    });
  });
});

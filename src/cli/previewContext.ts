/**
 * A fully-populated mock render context for the `init` preview. Every widget
 * has representative data here so the preview shows exactly what the user
 * picked — unlike a live render, where data-less widgets (no git repo, no
 * cache activity, …) legitimately hide and make the preview look truncated.
 *
 * All values are fixed (no clock, no filesystem) so the preview is
 * deterministic: `now`/`cacheExpiresAt` are chosen to show a ~4:43 countdown.
 */
import { ZERO_TOTALS } from '../transcript/parseTranscript.js';
import type { WidgetContext } from '../widgets/Widget.js';

export function previewContext(): WidgetContext {
  return {
    status: {
      model: { id: 'claude-opus-4-8', display_name: 'Opus 4.8' },
      cwd: '/Users/you/Documents/work/voice-connect',
      effort: { level: 'high' },
      context_window: { used_percentage: 42 },
      rate_limits: { five_hour: { used_percentage: 18 } },
      cost: { total_cost_usd: 1.23 },
    },
    totals: {
      ...ZERO_TOTALS,
      costUsd: 1.23,
      cacheReadTokens: 9000,
      cacheCreationTokens: 1000,
      compactions: 1,
      contextTokens: 84_000,
      cacheExpiresAt: 300_000,
    },
    git: { branch: 'main', changes: { added: 12, deleted: 3 } },
    now: 17_000,
    home: '/Users/you',
  };
}

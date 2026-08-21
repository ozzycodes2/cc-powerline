/**
 * The v1 widget manifest. Each widget maps context → display text (or null to
 * hide). Consolidated into one module — the widgets are small and share the
 * same shape, so a registry object reads better than a file each.
 */
import type { Widget, WidgetContext } from './Widget.js';
import {
  basename,
  compressPath,
  formatCost,
  formatDuration,
  formatPercent,
  optString,
} from './format.js';

// Default Nerd Font glyphs (classic Font-Awesome/Octicons range, present in
// virtually every Nerd Font). Every one is overridable via `options.icon`.
const ICON_EFFORT = '\u{f0e7}'; //  bolt
const ICON_CHANGES = '\u{f440}'; //  diff
const ICON_CONTEXT = '\u{f0e4}'; //  tachometer/gauge
const ICON_COMPACT = '\u{f066}'; //  compress
const ICON_CLOCK = '\u{f017}'; //  clock

const model: Widget = {
  type: 'model',
  render: (ctx) => ctx.status.model?.display_name ?? ctx.status.model?.id ?? null,
};

/** The model's reasoning-effort level (e.g. `high`), hidden when unset. */
const modelEffort: Widget = {
  type: 'model-effort',
  render: (ctx, options) => {
    const level = ctx.status.effort?.level;
    if (typeof level !== 'string' || level.length === 0) {
      return null;
    }
    const icon = optString(options, 'icon', ICON_EFFORT);
    return icon ? `${icon} ${level}` : level;
  },
};

const gitBranch: Widget = {
  type: 'git-branch',
  render: (ctx, options) => {
    if (!ctx.git.branch) {
      return null;
    }
    const icon = optString(options, 'icon', ''); //  Powerline branch glyph
    return icon ? `${icon} ${ctx.git.branch}` : ctx.git.branch;
  },
};

/**
 * The working directory. Default `compressed` mode is powerline-style — `~`
 * for home, parents shortened to one char, last segment in full. `basename`
 * and `full` are available via `options.mode`.
 */
const directory: Widget = {
  type: 'directory',
  render: (ctx, options) => {
    const dir = ctx.status.cwd ?? ctx.status.workspace?.project_dir;
    if (!dir) {
      return null;
    }
    const mode = optString(options, 'mode', 'compressed');
    if (mode === 'basename') {
      return basename(dir);
    }
    if (mode === 'full') {
      return dir;
    }
    return compressPath(dir, ctx.home);
  },
};

/** Percentage of the context window consumed. */
const contextLength: Widget = {
  type: 'context-length',
  render: (ctx, options) => {
    const label = optString(options, 'label', ICON_CONTEXT);
    const cw = ctx.status.context_window;
    let pct: number | null = null;
    if (typeof cw?.used_percentage === 'number') {
      pct = cw.used_percentage;
    } else if (typeof cw?.context_window_size === 'number' && cw.context_window_size > 0) {
      pct = (ctx.totals.contextTokens / cw.context_window_size) * 100;
    }
    if (pct === null) {
      return null;
    }
    return label ? `${label} ${formatPercent(pct)}` : formatPercent(pct);
  },
};

/** Working-tree line churn vs. HEAD, e.g. ` +12 -3`, hidden when clean. */
const gitChanges: Widget = {
  type: 'git-changes',
  render: (ctx, options) => {
    const c = ctx.git.changes;
    if (!c || (c.added === 0 && c.deleted === 0)) {
      return null;
    }
    const icon = optString(options, 'icon', ICON_CHANGES);
    const body = `+${c.added} -${c.deleted}`;
    return icon ? `${icon} ${body}` : body;
  },
};

/** Count of compaction events so far this session, hidden at zero. */
const compactions: Widget = {
  type: 'compactions',
  render: (ctx, options) => {
    const n = ctx.totals.compactions;
    if (!n || n <= 0) {
      return null;
    }
    const icon = optString(options, 'icon', ICON_COMPACT);
    return icon ? `${icon} ${n}` : `${n}`;
  },
};

/** Countdown to prompt-cache expiry, e.g. ` 4:12`, hidden once expired/unknown. */
const cacheWindow: Widget = {
  type: 'cache-window',
  render: (ctx, options) => {
    const exp = ctx.totals.cacheExpiresAt;
    if (exp === null || typeof ctx.now !== 'number') {
      return null;
    }
    const remaining = exp - ctx.now;
    if (remaining <= 0) {
      return null;
    }
    const icon = optString(options, 'icon', ICON_CLOCK);
    const body = formatDuration(remaining);
    return icon ? `${icon} ${body}` : body;
  },
};

/** Precise running session cost from the transcript, falling back to Claude
 * Code's reported cost when no transcript spend is available. */
const sessionCost: Widget = {
  type: 'session-cost',
  render: (ctx) => {
    const cost =
      ctx.totals.costUsd > 0 ? ctx.totals.costUsd : ctx.status.cost?.total_cost_usd ?? 0;
    return formatCost(cost);
  },
};

const cacheHitRate: Widget = {
  type: 'cache-hit-rate',
  render: (ctx, options) => {
    const label = optString(options, 'label', 'cache');
    const { cacheReadTokens, cacheCreationTokens } = ctx.totals;
    const denom = cacheReadTokens + cacheCreationTokens;
    if (denom <= 0) {
      return null;
    }
    return `${label}:${formatPercent((cacheReadTokens / denom) * 100)}`;
  },
};

const rateLimit: Widget = {
  type: 'rate-limit',
  render: (ctx, options) => {
    const label = optString(options, 'label', '5h');
    const pct = ctx.status.rate_limits?.five_hour?.used_percentage;
    return typeof pct === 'number' ? `${label}:${formatPercent(pct)}` : null;
  },
};

const separator: Widget = {
  type: 'separator',
  render: (_ctx, options) => optString(options, 'char', '|'),
};

const ALL: Widget[] = [
  model,
  modelEffort,
  gitBranch,
  gitChanges,
  directory,
  contextLength,
  sessionCost,
  cacheHitRate,
  cacheWindow,
  compactions,
  rateLimit,
  separator,
];

export const WIDGET_REGISTRY: Record<string, Widget> = Object.fromEntries(
  ALL.map((w) => [w.type, w]),
);

/** Every widget type available in v1. */
export const WIDGET_TYPES: string[] = ALL.map((w) => w.type);

/** Render one widget by type; unknown types and null results are omitted. */
export function renderWidget(
  type: string,
  ctx: WidgetContext,
  options?: Record<string, unknown>,
): string | null {
  const widget = WIDGET_REGISTRY[type];
  return widget ? widget.render(ctx, options) : null;
}

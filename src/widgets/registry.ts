/**
 * The v1 widget manifest. Each widget is a self-describing descriptor: a typed
 * options schema (with defaults), a composed render, and a mock `sample()`
 * slice for the init preview.
 */
import { z } from 'zod';
import { defineWidget, type WidgetContext, type WidgetDef } from './Widget.js';
import { prefixIcon, prefixLabel, prefixed, type Core } from './compose.js';
import { basename, compressPath, formatCost, formatDuration, formatPercent } from './format.js';

// Default Nerd Font glyphs (present in virtually every Nerd Font).
const ICON_EFFORT = '\u{f0e7}'; //  bolt
const ICON_CHANGES = '\u{f440}'; //  diff
const ICON_CONTEXT = '\u{f0e4}'; //  gauge
const ICON_COMPACT = '\u{f066}'; //  compress
const ICON_CLOCK = '\u{f017}'; //  clock
const ICON_BRANCH = '\u{e0a0}'; //  powerline branch

const NO_OPTS = z.object({});

const model = defineWidget({
  type: 'model',
  options: NO_OPTS,
  render: (ctx) => ctx.status.model?.display_name ?? ctx.status.model?.id ?? null,
  sample: () => ({ status: { model: { id: 'claude-opus-4-8', display_name: 'Opus 4.8' } } }),
});

const modelEffort = defineWidget({
  type: 'model-effort',
  options: z.object({ icon: z.string().default(ICON_EFFORT) }),
  render: prefixIcon((ctx) => {
    const level = ctx.status.effort?.level;
    return typeof level === 'string' && level.length > 0 ? level : null;
  }),
  sample: () => ({ status: { effort: { level: 'high' } } }),
});

const gitBranch = defineWidget({
  type: 'git-branch',
  options: z.object({ icon: z.string().default(ICON_BRANCH) }),
  render: prefixIcon((ctx) => ctx.git.branch ?? null),
  sample: () => ({ git: { branch: 'main' } }),
});

const gitChanges = defineWidget({
  type: 'git-changes',
  options: z.object({ icon: z.string().default(ICON_CHANGES) }),
  render: prefixIcon((ctx) => {
    const c = ctx.git.changes;
    if (!c || (c.added === 0 && c.deleted === 0)) {
      return null;
    }
    return `+${c.added} -${c.deleted}`;
  }),
  sample: () => ({ git: { changes: { added: 12, deleted: 3 } } }),
});

const directory = defineWidget({
  type: 'directory',
  options: z.object({ mode: z.enum(['compressed', 'basename', 'full']).default('compressed') }),
  render: (ctx, opts) => {
    const dir = ctx.status.cwd ?? ctx.status.workspace?.project_dir;
    if (!dir) {
      return null;
    }
    if (opts.mode === 'basename') {
      return basename(dir);
    }
    if (opts.mode === 'full') {
      return dir;
    }
    return compressPath(dir, ctx.home);
  },
  sample: () => ({ status: { cwd: '/Users/you/Documents/work/voice-connect' } }),
});

const contextLength = defineWidget({
  type: 'context-length',
  options: z.object({ label: z.string().default(ICON_CONTEXT) }),
  render: prefixed<{ label: string }>('label', ' ', 'skip-empty', (ctx) => {
    const cw = ctx.status.context_window;
    let pct: number | null = null;
    if (typeof cw?.used_percentage === 'number') {
      pct = cw.used_percentage;
    } else if (typeof cw?.context_window_size === 'number' && cw.context_window_size > 0) {
      pct = (ctx.totals.contextTokens / cw.context_window_size) * 100;
    }
    return pct === null ? null : formatPercent(pct);
  }),
  sample: () => ({ status: { context_window: { used_percentage: 42 } }, totals: { contextTokens: 84_000 } }),
});

const sessionCost = defineWidget({
  type: 'session-cost',
  options: NO_OPTS,
  render: (ctx) => {
    const cost = ctx.totals.costUsd > 0 ? ctx.totals.costUsd : ctx.status.cost?.total_cost_usd ?? 0;
    return formatCost(cost);
  },
  sample: () => ({ status: { cost: { total_cost_usd: 1.23 } }, totals: { costUsd: 1.23 } }),
});

const cacheHitRate = defineWidget({
  type: 'cache-hit-rate',
  options: z.object({ label: z.string().default('cache') }),
  render: prefixLabel<{ label: string }>((ctx) => {
    const { cacheReadTokens, cacheCreationTokens } = ctx.totals;
    const denom = cacheReadTokens + cacheCreationTokens;
    return denom <= 0 ? null : formatPercent((cacheReadTokens / denom) * 100);
  }),
  sample: () => ({ totals: { cacheReadTokens: 9000, cacheCreationTokens: 1000 } }),
});

const cacheWindow = defineWidget({
  type: 'cache-window',
  options: z.object({ icon: z.string().default(ICON_CLOCK) }),
  render: prefixIcon((ctx) => {
    const exp = ctx.totals.cacheExpiresAt;
    if (exp === null || typeof ctx.now !== 'number') {
      return null;
    }
    const remaining = exp - ctx.now;
    return remaining <= 0 ? null : formatDuration(remaining);
  }),
  sample: () => ({ totals: { cacheExpiresAt: 300_000 } }),
});

const compactions = defineWidget({
  type: 'compactions',
  options: z.object({ icon: z.string().default(ICON_COMPACT) }),
  render: prefixIcon((ctx) => {
    const n = ctx.totals.compactions;
    return !n || n <= 0 ? null : `${n}`;
  }),
  sample: () => ({ totals: { compactions: 1 } }),
});

const rateLimit = defineWidget({
  type: 'rate-limit',
  options: z.object({ label: z.string().default('5h') }),
  render: prefixLabel<{ label: string }>((ctx) => {
    const pct = ctx.status.rate_limits?.five_hour?.used_percentage;
    return typeof pct === 'number' ? formatPercent(pct) : null;
  }),
  sample: () => ({ status: { rate_limits: { five_hour: { used_percentage: 18 } } } }),
});

const separator = defineWidget({
  type: 'separator',
  options: z.object({ char: z.string().default('|') }),
  render: (_ctx, opts) => opts.char,
});

export const WIDGET_DEFS: WidgetDef[] = [
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

export const WIDGET_REGISTRY: Record<string, WidgetDef> = Object.fromEntries(
  WIDGET_DEFS.map((w) => [w.type, w]),
);

/** Every widget type available in v1. */
export const WIDGET_TYPES: string[] = WIDGET_DEFS.map((w) => w.type);

/**
 * Parse raw config options through a widget's schema, filling defaults.
 * Unknown widget → `{}`; invalid options degrade to the schema defaults so a
 * bad config never throws into the render path.
 */
export function parseWidgetOptions(type: string, raw: unknown): unknown {
  const widget = WIDGET_REGISTRY[type];
  if (!widget) {
    return {};
  }
  const parsed = widget.options.safeParse(raw ?? {});
  return parsed.success ? parsed.data : widget.options.parse({});
}

/** Render one widget by type; unknown types and null results are omitted. */
export function renderWidget(
  type: string,
  ctx: WidgetContext,
  options?: unknown,
): string | null {
  const widget = WIDGET_REGISTRY[type];
  return widget ? widget.render(ctx, parseWidgetOptions(type, options)) : null;
}

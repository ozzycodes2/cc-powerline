/**
 * The v1 widget manifest. Each widget is a self-describing descriptor: a typed
 * options schema (with defaults), a composed render, and a mock `sample()`
 * slice for the init preview.
 */
import { z } from 'zod';
import { defineWidget, type WidgetContext, type WidgetDef } from './Widget.js';
import { prefixIcon, prefixLabel, prefixed } from './compose.js';
import {
  basename,
  compressPath,
  formatCost,
  formatDuration,
  formatMoney,
  formatPercent,
  formatTokens,
} from './format.js';

// Default Nerd Font glyphs (present in virtually every Nerd Font).
const ICON_CHANGES = '\u{f440}'; //  diff
const ICON_CONTEXT = '\u{f0e4}'; //  gauge
const ICON_COMPACT = '\u{f066}'; //  compress
const ICON_CLOCK = '\u{f017}'; //  clock
const ICON_BRANCH = '\u{e0a0}'; //  powerline branch
const ICON_BRANCH_MAIN = '\u{f015}'; //  home (on the main/trunk branch)
const ICON_WORKTREE = '\u{f126}'; //  code-fork (in a linked worktree)
const ICON_CACHE = '\u{f1c0}'; //  database (cache)
const ICON_TOKENS = '\u{f2db}'; //  microchip (tokens)

/** The conventional trunk branch names that get the "main" icon. */
const MAIN_BRANCHES = new Set(['main', 'master']);

const NO_OPTS = z.object({});

const model = defineWidget({
  type: 'model',
  label: 'Model',
  description: 'Active model display name',
  options: NO_OPTS,
  render: (ctx) =>
    ctx.status.model?.display_name ?? ctx.status.model?.id ?? null,
  sample: () => ({
    status: { model: { id: 'claude-opus-4-8', display_name: 'Opus 4.8' } },
  }),
});

const modelEffort = defineWidget({
  type: 'model-effort',
  label: 'Model effort',
  description: 'Reasoning effort level (e.g. high)',
  options: NO_OPTS,
  render: (ctx) => {
    const level = ctx.status.effort?.level;
    return typeof level === 'string' && level.length > 0 ? level : null;
  },
  sample: () => ({ status: { effort: { level: 'high' } } }),
});

const gitBranch = defineWidget({
  type: 'git-branch',
  label: 'Git branch',
  description: 'Current branch name, with a state-specific icon',
  // Three icons pick out the git state at a glance: a linked worktree, the
  // main/trunk branch, or any other branch (the default powerline glyph).
  options: z.object({
    icon: z.string().default(ICON_BRANCH),
    mainIcon: z.string().default(ICON_BRANCH_MAIN),
    worktreeIcon: z.string().default(ICON_WORKTREE),
  }),
  render: (ctx, opts) => {
    const branch = ctx.git.branch;
    if (!branch) {
      return null;
    }
    // Worktree wins over branch name: being outside the main checkout is the
    // more notable state, even when that worktree happens to sit on main.
    const icon = ctx.git.worktree
      ? opts.worktreeIcon
      : MAIN_BRANCHES.has(branch)
        ? opts.mainIcon
        : opts.icon;
    // Empty icon means "no prefix", matching the shared prefixIcon behavior.
    return icon ? `${icon} ${branch}` : branch;
  },
  sample: () => ({ git: { branch: 'main' } }),
});

const gitChanges = defineWidget({
  type: 'git-changes',
  label: 'Git changes',
  description: 'Added / deleted line counts',
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
  label: 'Directory',
  description: 'Working directory path',
  options: z.object({
    mode: z.enum(['compressed', 'basename', 'full']).default('compressed'),
  }),
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
  sample: () => ({
    status: { cwd: '/Users/you/Documents/work/cc-powerline' },
  }),
});

const contextLength = defineWidget({
  type: 'context-length',
  label: 'Context length',
  description: 'Percent of the context window used',
  options: z.object({ label: z.string().default(ICON_CONTEXT) }),
  render: prefixed<{ label: string }>('label', ' ', 'skip-empty', (ctx) => {
    const cw = ctx.status.context_window;
    let pct: number | null = null;
    if (typeof cw?.used_percentage === 'number') {
      pct = cw.used_percentage;
    } else if (
      typeof cw?.context_window_size === 'number' &&
      cw.context_window_size > 0
    ) {
      pct = (ctx.totals.contextTokens / cw.context_window_size) * 100;
    }
    return pct === null ? null : formatPercent(pct);
  }),
  sample: () => ({
    status: { context_window: { used_percentage: 42 } },
    totals: { contextTokens: 84_000 },
  }),
});

const sessionCost = defineWidget({
  type: 'session-cost',
  label: 'Session cost',
  description: 'Total USD spent this session',
  options: NO_OPTS,
  render: (ctx) => {
    const cost =
      ctx.totals.costUsd > 0
        ? ctx.totals.costUsd
        : (ctx.status.cost?.total_cost_usd ?? 0);
    return formatCost(cost);
  },
  sample: () => ({
    status: { cost: { total_cost_usd: 1.23 } },
    totals: { costUsd: 1.23 },
  }),
});

/**
 * ceejbot's per-family input rate in $/MTok, keyed off the model display name —
 * the only model signal the status hook provides. An unknown family returns
 * null so the projection hides rather than quoting a wrong number.
 */
function baseInputPrice(name: string | undefined): number | null {
  const n = (name ?? '').toLowerCase();
  if (n.includes('fable') || n.includes('mythos')) {
    return 10;
  }
  if (n.includes('opus')) {
    return 5;
  }
  if (n.includes('sonnet')) {
    return 3;
  }
  if (n.includes('haiku')) {
    return 1;
  }
  return null;
}

const nextCost = defineWidget({
  type: 'next-cost',
  label: 'Next-message cost',
  description: 'Projected warm→cold cost of the next turn',
  options: z.object({ icon: z.string().default('') }),
  render: prefixIcon((ctx) => {
    const tokens = ctx.totals.contextTokens;
    const base = baseInputPrice(
      ctx.status.model?.display_name ?? ctx.status.model?.id,
    );
    if (base === null || tokens <= 0) {
      return null;
    }
    const mtok = tokens / 1_000_000;
    // Warm = re-read the context from a live cache (0.1x). Cold = rebuild it
    // after expiry: 2x for the 1-hour tier, 1.25x for the 5-minute tier. An
    // unknown tier defaults to the cheaper 5-minute rate. Output tokens are
    // unknowable in advance and, like ceejbot, deliberately excluded.
    const oneHour =
      ctx.totals.cacheTtlMs !== null && ctx.totals.cacheTtlMs >= 3_600_000;
    const warm = mtok * base * 0.1;
    const cold = mtok * base * (oneHour ? 2 : 1.25);
    // Once the cache has gone cold the warm price is unreachable, so collapse to
    // the rebuild cost alone — it is now the floor for the next message. Expiry
    // is only known when a timestamped cache write and a clock are both present;
    // absent either, assume still-warm and show the full projection.
    const exp = ctx.totals.cacheExpiresAt;
    const expired =
      exp !== null && typeof ctx.now === 'number' && ctx.now >= exp;
    return expired
      ? formatMoney(cold)
      : `${formatMoney(warm)}→${formatMoney(cold)}`;
  }),
  sample: () => ({
    status: { model: { display_name: 'Opus 4.8' } },
    totals: { contextTokens: 84_000, cacheTtlMs: 300_000 },
  }),
});

const cacheHitRate = defineWidget({
  type: 'cache-hit-rate',
  label: 'Cache hit rate',
  description: 'Cache-read share of prompt tokens',
  options: z.object({ icon: z.string().default(ICON_CACHE) }),
  render: prefixIcon((ctx) => {
    const { cacheReadTokens, cacheCreationTokens } = ctx.totals;
    const denom = cacheReadTokens + cacheCreationTokens;
    return denom <= 0 ? null : formatPercent((cacheReadTokens / denom) * 100);
  }),
  sample: () => ({
    totals: { cacheReadTokens: 9000, cacheCreationTokens: 1000 },
  }),
});

const totalTokens = defineWidget({
  type: 'total-tokens',
  label: 'Total tokens',
  description: 'All tokens consumed this session (input+output+cache)',
  options: z.object({ icon: z.string().default(ICON_TOKENS) }),
  render: prefixIcon((ctx) => {
    const { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens } =
      ctx.totals;
    const total =
      inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
    return total <= 0 ? null : formatTokens(total);
  }),
  // Contribute only input/output; the cache streams come from cache-hit-rate's
  // sample, so the merged preview total stays consistent across both widgets.
  sample: () => ({ totals: { inputTokens: 12_000, outputTokens: 3400 } }),
});

const cacheWindow = defineWidget({
  type: 'cache-window',
  label: 'Cache window',
  description: 'Time left before the prompt cache expires',
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
  label: 'Compactions',
  description: 'Number of context compactions so far',
  options: z.object({ icon: z.string().default(ICON_COMPACT) }),
  render: prefixIcon((ctx) => {
    const n = ctx.totals.compactions;
    return !n || n <= 0 ? null : `${n}`;
  }),
  sample: () => ({ totals: { compactions: 1 } }),
});

const rateLimit = defineWidget({
  type: 'rate-limit',
  label: 'Rate limit',
  description: 'Percent of the 5-hour rate limit used',
  options: z.object({ label: z.string().default('5h') }),
  render: prefixLabel<{ label: string }>((ctx) => {
    const pct = ctx.status.rate_limits?.five_hour?.used_percentage;
    return typeof pct === 'number' ? formatPercent(pct) : null;
  }),
  sample: () => ({
    status: { rate_limits: { five_hour: { used_percentage: 18 } } },
  }),
});

const separator = defineWidget({
  type: 'separator',
  label: 'Separator',
  description: 'A literal divider character',
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
  nextCost,
  cacheHitRate,
  totalTokens,
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

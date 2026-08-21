# Statusline Layering Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor cc-powerline so each widget is a self-describing unit (typed options schema + render + mock sample slice), the config layer resolves a value cascade, and the TUI preview is derived from the widgets — with byte-identical render output.

**Architecture:** Widgets become `WidgetDef<O>` descriptors carrying a Zod options schema (with defaults), a composed `render(ctx, opts)`, and a `sample()` context slice. A new pure `resolveSettings()` in the config layer applies the fg/bg cascade (item → line → theme → builtin) and parses each widget's options, producing a `ResolvedSettings` the pipeline consumes. The preview context is derived by deep-merging every widget's `sample()` slice onto a small cross-cutting base and running the real render path.

**Tech Stack:** TypeScript (ESM, NodeNext), Zod, Vitest. Pure functions + injectable dependencies house style. Repo-local binaries: `node_modules/.bin/{vitest,tsc}`.

**Spec:** `docs/superpowers/specs/2026-08-21-statusline-layering-refactor-design.md`

## Global Constraints

- **Byte-identical render output.** The golden snapshots `test/golden/builtin-80.snap.txt` and `test/golden/powerline-80.snap.txt` must never change. Every resolved default (icons, colors, separators) is pinned to today's value.
- **Never throw into the render path.** Malformed config/options degrade to defaults (Zod `safeParse` → `parse({})`), matching `src/types/StatusJSON.ts` / `src/types/Settings.ts`.
- **House style:** pure functions, no classes; all IO stays injectable. New modules are pure and unit-tested with plain fakes.
- **Coverage:** ≥90% on new/changed code. Verify with `node_modules/.bin/vitest run --coverage` at the end.
- **Run from repo root** `~/Documents/work/cc-powerline`; use repo-local binaries to avoid PATH surprises.
- **Commit format:** `<conventional_prefix>: <message>` (no ticket; branch `master` is not ticket-prefixed). End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Pinned default glyphs** (copy verbatim from current `src/widgets/registry.ts`): effort `'\u{f0e7}'`, changes `'\u{f440}'`, context `'\u{f0e4}'`, compact `'\u{f066}'`, clock `'\u{f017}'`, git-branch default icon `''` (the Powerline branch glyph — currently the literal `''` passed to `optString`).

---

### Task 1: Composition helpers

**Files:**
- Create: `src/widgets/compose.ts`
- Test: `test/widgets/compose.test.ts`

**Interfaces:**
- Consumes: `WidgetContext` from `src/widgets/Widget.js`.
- Produces:
  - `type Core<O> = (ctx: WidgetContext, opts: O) => string | null`
  - `prefixed<O>(key: string, sep: string, mode: 'skip-empty' | 'always', core: Core<O>): Core<O>`
  - `prefixIcon<O>(core: Core<O>): Core<O>` (key `'icon'`, sep `' '`, `'skip-empty'`)
  - `prefixLabel<O>(core: Core<O>, sep?: string): Core<O>` (key `'label'`, default sep `':'`, `'always'`)

- [ ] **Step 1: Write the failing test**

```ts
// test/widgets/compose.test.ts
import { describe, it, expect } from 'vitest';
import { prefixed, prefixIcon, prefixLabel } from '../../src/widgets/compose.js';
import type { WidgetContext } from '../../src/widgets/Widget.js';

const ctx = {} as WidgetContext;

describe('prefixed', () => {
  it('hides when the core value is null or empty', () => {
    expect(prefixed('icon', ' ', 'skip-empty', () => null)(ctx, {})).toBeNull();
    expect(prefixed('icon', ' ', 'skip-empty', () => '')(ctx, {})).toBeNull();
  });

  it('skip-empty omits the prefix when the option is empty', () => {
    const r = prefixed<{ icon?: string }>('icon', ' ', 'skip-empty', () => 'body');
    expect(r(ctx, {})).toBe('body');
    expect(r(ctx, { icon: '' })).toBe('body');
    expect(r(ctx, { icon: 'X' })).toBe('X body');
  });

  it('always joins with the separator, even when the option is empty', () => {
    const r = prefixed<{ label?: string }>('label', ':', 'always', () => 'v');
    expect(r(ctx, { label: 'cache' })).toBe('cache:v');
    expect(r(ctx, { label: '' })).toBe(':v');
  });
});

describe('prefixIcon / prefixLabel', () => {
  it('prefixIcon is icon + space, skip-empty', () => {
    const r = prefixIcon<{ icon?: string }>(() => 'main');
    expect(r(ctx, { icon: 'g' })).toBe('g main');
    expect(r(ctx, { icon: '' })).toBe('main');
  });
  it('prefixLabel is label + colon by default, always', () => {
    const r = prefixLabel<{ label?: string }>(() => '75%');
    expect(r(ctx, { label: 'cache' })).toBe('cache:75%');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run test/widgets/compose.test.ts`
Expected: FAIL — cannot find module `src/widgets/compose.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/widgets/compose.ts
/**
 * Composition helpers that give widgets their shared "prefix + hide-when-empty"
 * behavior without repeating it in every render body. A widget's core producer
 * returns the bare value (or null to hide); a wrapper adds the icon/label.
 */
import type { WidgetContext } from './Widget.js';

export type Core<O> = (ctx: WidgetContext, opts: O) => string | null;

/**
 * Wrap a core value with a prefix read from `opts[key]`.
 * `skip-empty` omits the prefix (and separator) when the option is empty,
 * matching icon-style widgets; `always` joins unconditionally, matching
 * label-style widgets (`cache:75%`). A null/empty core value hides the widget.
 */
export function prefixed<O extends Record<string, unknown>>(
  key: string,
  sep: string,
  mode: 'skip-empty' | 'always',
  core: Core<O>,
): Core<O> {
  return (ctx, opts) => {
    const body = core(ctx, opts);
    if (body === null || body === '') {
      return null;
    }
    const raw = opts[key];
    const prefix = typeof raw === 'string' ? raw : '';
    if (mode === 'skip-empty' && prefix === '') {
      return body;
    }
    return `${prefix}${sep}${body}`;
  };
}

export const prefixIcon = <O extends Record<string, unknown>>(core: Core<O>): Core<O> =>
  prefixed<O>('icon', ' ', 'skip-empty', core);

export const prefixLabel = <O extends Record<string, unknown>>(
  core: Core<O>,
  sep = ':',
): Core<O> => prefixed<O>('label', sep, 'always', core);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/vitest run test/widgets/compose.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/compose.ts test/widgets/compose.test.ts
git commit -m "$(cat <<'EOF'
feat: add widget composition helpers

Introduce prefixed/prefixIcon/prefixLabel so widgets share their
icon/label-prefix and hide-when-empty behavior through composition instead
of repeating optString + null checks in every render body. Groundwork for
the widget-descriptor refactor.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Widget descriptor + registry rewrite

**Files:**
- Modify: `src/widgets/Widget.ts`
- Modify: `src/widgets/registry.ts` (full rewrite of the definitions)
- Test: `test/widgets/registry.test.ts` (existing — must stay green), add `test/widgets/registryShape.test.ts`

**Interfaces:**
- Consumes: `Core`, `prefixIcon`, `prefixLabel`, `prefixed` from `src/widgets/compose.js`; format helpers from `src/widgets/format.js`; `z` from `zod`.
- Produces (from `Widget.ts`):
  - `type PartialContext` — a deep-partial of `WidgetContext`.
  - `interface WidgetDef<O = unknown> { type: string; options: z.ZodType<O>; render(ctx: WidgetContext, opts: O): string | null; sample?(): PartialContext; }`
  - `function defineWidget<S extends z.ZodType>(def: { type: string; options: S; render: (ctx: WidgetContext, opts: z.infer<S>) => string | null; sample?: () => PartialContext }): WidgetDef<z.infer<S>>`
- Produces (from `registry.ts`, names unchanged where already public):
  - `WIDGET_DEFS: WidgetDef[]` (NEW — ordered array, consumed by the preview)
  - `WIDGET_REGISTRY: Record<string, WidgetDef>`
  - `WIDGET_TYPES: string[]`
  - `parseWidgetOptions(type: string, raw: unknown): unknown` (NEW)
  - `renderWidget(type: string, ctx: WidgetContext, options?: unknown): string | null`

- [ ] **Step 1: Write the failing test (descriptor shape invariants)**

```ts
// test/widgets/registryShape.test.ts
import { describe, it, expect } from 'vitest';
import { WIDGET_DEFS, WIDGET_TYPES, parseWidgetOptions } from '../../src/widgets/registry.js';

describe('widget descriptors', () => {
  it('every widget declares an options schema', () => {
    for (const d of WIDGET_DEFS) {
      expect(typeof d.options.safeParse).toBe('function');
    }
  });

  it('WIDGET_DEFS order matches WIDGET_TYPES', () => {
    expect(WIDGET_DEFS.map((d) => d.type)).toEqual(WIDGET_TYPES);
  });

  it('parseWidgetOptions fills defaults and degrades bad input', () => {
    // git-branch default icon is the powerline branch glyph U+E0A0
    expect(parseWidgetOptions('git-branch', {})).toEqual({ icon: '' });
    // wrong type degrades to defaults rather than throwing
    expect(parseWidgetOptions('git-branch', { icon: 123 })).toEqual({ icon: '' });
    // unknown widget → empty options
    expect(parseWidgetOptions('nope', { x: 1 })).toEqual({});
  });

  it('every widget with data-bearing sample renders non-null against its own sample', () => {
    // Guards the "widget declares its own mock" contract.
    const { previewContext } = require('../../src/cli/previewContext.js');
    // Skipped here; covered fully in Task 6. Placeholder keeps intent visible.
    expect(typeof previewContext === 'function' || previewContext === undefined).toBe(true);
  });
});
```

Note: delete the last `it(...)` block before committing if `previewContext` is not yet derived — the real invariant test lands in Task 6. It is included here only to record intent; keep the first three assertions.

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run test/widgets/registryShape.test.ts`
Expected: FAIL — `WIDGET_DEFS` / `parseWidgetOptions` not exported yet.

- [ ] **Step 3: Rewrite `Widget.ts`**

```ts
// src/widgets/Widget.ts
/** Widget descriptor and the context passed to every widget at render time. */
import type { z } from 'zod';
import type { StatusJSON } from '../types/StatusJSON.js';
import type { TranscriptTotals } from '../transcript/parseTranscript.js';
import type { GitChanges } from '../git.js';

export interface WidgetContext {
  status: StatusJSON;
  totals: TranscriptTotals;
  /** Resolved git info (branch + churn resolved once by the pipeline). */
  git: { branch: string | null; changes?: GitChanges | null };
  /** Wall-clock epoch ms, injected so the cache-window countdown is testable. */
  now?: number;
  /** Home directory, injected for powerline path compression. */
  home?: string;
}

/** Deep-partial of the render context — the shape a widget's `sample()` returns. */
export type PartialContext = {
  [K in keyof WidgetContext]?: WidgetContext[K] extends object
    ? Partial<WidgetContext[K]>
    : WidgetContext[K];
};

export interface WidgetDef<O = unknown> {
  type: string;
  /** Zod schema for this widget's options; every field carries a `.default()`. */
  options: z.ZodType<O>;
  /** Produce display text, or `null` to omit the widget. Options are typed + defaulted. */
  render(ctx: WidgetContext, opts: O): string | null;
  /** Deep-partial mock slice merged into the TUI preview context. */
  sample?(): PartialContext;
}

/** Identity factory that infers the options type from the Zod schema. */
export function defineWidget<S extends z.ZodType>(def: {
  type: string;
  options: S;
  render: (ctx: WidgetContext, opts: z.infer<S>) => string | null;
  sample?: () => PartialContext;
}): WidgetDef<z.infer<S>> {
  return def;
}
```

- [ ] **Step 4: Rewrite `registry.ts`**

```ts
// src/widgets/registry.ts
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
const ICON_BRANCH = ''; //  powerline branch

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
```

Note on `_ctx`: `void _ctx;` is not needed — the parameter is used positionally by the `render` signature; keep the leading underscore to satisfy the no-unused-vars lint.

- [ ] **Step 5: Delete the placeholder `it` block**

Remove the fourth `it('every widget with data-bearing sample...')` from `test/widgets/registryShape.test.ts` (the real version lands in Task 6). Keep the three concrete assertions.

- [ ] **Step 6: Run the full suite to verify green**

Run: `node_modules/.bin/vitest run && node_modules/.bin/tsc --noEmit`
Expected: all pass, tsc clean. The existing `test/widgets/registry.test.ts` still passes because `renderWidget` accepts raw options and parses them; the golden snapshots are unchanged because every default is pinned to its previous value.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/Widget.ts src/widgets/registry.ts test/widgets/registryShape.test.ts
git commit -m "$(cat <<'EOF'
refactor: make widgets self-describing descriptors

Turn each widget into a WidgetDef carrying a typed Zod options schema (with
defaults), a composed render, and a mock sample() slice. Option defaults
move out of the render bodies into the schemas, and parseWidgetOptions
becomes the single defaulting/degradation point. Render output is unchanged;
every default is pinned to its prior value.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Config schema — line-level defaults

**Files:**
- Modify: `src/types/Settings.ts`
- Test: `test/config/loadSettings.test.ts` (add a case) or `test/types/settingsDefaults.test.ts` (NEW)

**Interfaces:**
- Produces: `LineConfig` now has optional `defaults?: { fg?: string; bg?: string }`. `LineConfigSchema` accepts and defaults it to `undefined`. Back-compatible: configs without `defaults` parse unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// test/types/settingsDefaults.test.ts
import { describe, it, expect } from 'vitest';
import { SettingsSchema } from '../../src/types/Settings.js';

describe('line-level defaults', () => {
  it('parses optional per-line fg/bg defaults', () => {
    const parsed = SettingsSchema.parse({
      style: 'powerline',
      lines: [{ left: [{ type: 'model' }], defaults: { fg: 'white', bg: '#123456' } }],
    });
    expect(parsed.lines[0]!.defaults).toEqual({ fg: 'white', bg: '#123456' });
  });

  it('leaves defaults undefined when omitted (back-compat)', () => {
    const parsed = SettingsSchema.parse({ lines: [{ left: [{ type: 'model' }] }] });
    expect(parsed.lines[0]!.defaults).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run test/types/settingsDefaults.test.ts`
Expected: FAIL — `defaults` stripped/undefined typed error.

- [ ] **Step 3: Modify `Settings.ts`**

Add the group-defaults schema and wire it into `LineConfigSchema`:

```ts
// src/types/Settings.ts — additions
export const GroupDefaultsSchema = z
  .object({
    fg: ColorSchema.optional(),
    bg: ColorSchema.optional(),
  })
  .optional();

export const LineConfigSchema = z.object({
  left: z.array(WidgetItemSchema).default([]),
  right: z.array(WidgetItemSchema).default([]),
  /** Fallback fg/bg for items in this line that omit their own. */
  defaults: GroupDefaultsSchema,
});
```

`LineConfig` type is re-inferred from the schema; no other change needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/vitest run test/types/settingsDefaults.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/types/Settings.ts test/types/settingsDefaults.test.ts
git commit -m "$(cat <<'EOF'
feat: add optional per-line color defaults to config schema

Lines can now carry a defaults:{fg,bg} block used as the cascade level
between a widget item's own colors and the global theme. Optional and
back-compatible; existing configs parse unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Config resolver — the value cascade

**Files:**
- Create: `src/config/resolveSettings.ts`
- Test: `test/config/resolveSettings.test.ts`

**Interfaces:**
- Consumes: `Settings`, `LineConfig` from `src/types/Settings.js`; `parseWidgetOptions` from `src/widgets/registry.js`; `DEFAULT_THEME`, `PowerlineTheme` from `src/render/powerlineRenderer.js`; `Color` from `src/render/types.js`.
- Produces:
  - `interface ResolvedItem { type: string; fg: Color; bg: Color; options: unknown }`
  - `interface ResolvedLine { left: ResolvedItem[]; right: ResolvedItem[] }`
  - `interface ResolvedSettings { style: 'powerline' | 'builtin'; separator?: string; theme: PowerlineTheme; lines: ResolvedLine[] }`
  - `function resolveSettings(settings: Settings): ResolvedSettings`

- [ ] **Step 1: Write the failing test**

```ts
// test/config/resolveSettings.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSettings } from '../../src/config/resolveSettings.js';
import { DEFAULT_THEME } from '../../src/render/powerlineRenderer.js';
import { SettingsSchema } from '../../src/types/Settings.js';

const parse = (raw: unknown) => SettingsSchema.parse(raw);

describe('resolveSettings cascade', () => {
  it('item colors win over line defaults, theme, and builtin', () => {
    const r = resolveSettings(
      parse({
        theme: { defaultFg: 'red', defaultBg: 'blue' },
        lines: [
          {
            defaults: { fg: 'green', bg: 'magenta' },
            left: [{ type: 'model', fg: 'white', bg: 'black' }],
          },
        ],
      }),
    );
    expect(r.lines[0]!.left[0]).toMatchObject({ fg: 'white', bg: 'black' });
  });

  it('falls through item -> line -> theme -> builtin', () => {
    const noLine = resolveSettings(
      parse({ theme: { defaultFg: 'red' }, lines: [{ left: [{ type: 'model' }] }] }),
    );
    // fg from theme, bg falls all the way to the builtin default
    expect(noLine.lines[0]!.left[0]!.fg).toBe('red');
    expect(noLine.lines[0]!.left[0]!.bg).toBe(DEFAULT_THEME.defaultBg);
  });

  it('uses line defaults when the item omits colors', () => {
    const r = resolveSettings(
      parse({ lines: [{ defaults: { fg: 'green', bg: 'magenta' }, left: [{ type: 'model' }] }] }),
    );
    expect(r.lines[0]!.left[0]).toMatchObject({ fg: 'green', bg: 'magenta' });
  });

  it('parses widget options with defaults and degrades bad ones', () => {
    const r = resolveSettings(
      parse({ lines: [{ left: [{ type: 'git-branch', options: { icon: 999 } }] }] }),
    );
    expect(r.lines[0]!.left[0]!.options).toEqual({ icon: '' });
  });

  it('keeps unknown widget types (they hide at render) with empty options', () => {
    const r = resolveSettings(parse({ lines: [{ left: [{ type: 'nope' }] }] }));
    expect(r.lines[0]!.left[0]).toMatchObject({ type: 'nope', options: {} });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run test/config/resolveSettings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/config/resolveSettings.ts
/**
 * Resolve a parsed {@link Settings} into fully-concrete render instructions.
 * This is the config layer's single responsibility: apply the fg/bg cascade
 * (item -> line defaults -> theme -> builtin) and parse each widget's options,
 * so the render layer only draws and never resolves defaults.
 */
import { DEFAULT_THEME, type PowerlineTheme } from '../render/powerlineRenderer.js';
import type { Color } from '../render/types.js';
import type { LineConfig, Settings, WidgetItem } from '../types/Settings.js';
import { parseWidgetOptions } from '../widgets/registry.js';

export interface ResolvedItem {
  type: string;
  fg: Color;
  bg: Color;
  options: unknown;
}

export interface ResolvedLine {
  left: ResolvedItem[];
  right: ResolvedItem[];
}

export interface ResolvedSettings {
  style: 'powerline' | 'builtin';
  separator?: string;
  theme: PowerlineTheme;
  lines: ResolvedLine[];
}

function resolveTheme(settings: Settings): PowerlineTheme {
  return {
    separator: settings.theme?.separator ?? DEFAULT_THEME.separator,
    rightSeparator: settings.theme?.rightSeparator ?? DEFAULT_THEME.rightSeparator,
    defaultFg: (settings.theme?.defaultFg as Color) ?? DEFAULT_THEME.defaultFg,
    defaultBg: (settings.theme?.defaultBg as Color) ?? DEFAULT_THEME.defaultBg,
  };
}

function resolveItem(
  item: WidgetItem,
  lineDefaults: LineConfig['defaults'],
  theme: PowerlineTheme,
): ResolvedItem {
  return {
    type: item.type,
    fg: (item.fg as Color) ?? (lineDefaults?.fg as Color) ?? theme.defaultFg,
    bg: (item.bg as Color) ?? (lineDefaults?.bg as Color) ?? theme.defaultBg,
    options: parseWidgetOptions(item.type, item.options),
  };
}

export function resolveSettings(settings: Settings): ResolvedSettings {
  const theme = resolveTheme(settings);
  return {
    style: settings.style,
    separator: settings.separator,
    theme,
    lines: settings.lines.map((line) => ({
      left: line.left.map((i) => resolveItem(i, line.defaults, theme)),
      right: line.right.map((i) => resolveItem(i, line.defaults, theme)),
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/vitest run test/config/resolveSettings.test.ts && node_modules/.bin/tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/config/resolveSettings.ts test/config/resolveSettings.test.ts
git commit -m "$(cat <<'EOF'
feat: add config resolver with fg/bg cascade

resolveSettings folds the item -> line -> theme -> builtin color cascade and
per-widget option parsing into one pure pass, producing ResolvedSettings with
concrete colors and typed options. Not yet wired into the pipeline.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire the pipeline to the resolver

**Files:**
- Modify: `src/pipeline.ts`
- Test: `test/pipeline.test.ts` (existing — must stay green), `test/golden/render.test.ts` (existing — must stay green)

**Interfaces:**
- Consumes: `resolveSettings`, `ResolvedItem` from `src/config/resolveSettings.js`.
- Produces: `buildStatus(settings: Settings, ctx: WidgetContext, width: number): string` — unchanged signature; internally resolves first. The renderers receive segments carrying concrete `fg`/`bg` and the resolved theme.

- [ ] **Step 1: Add a failing test asserting resolution is applied**

```ts
// test/pipeline.test.ts — add
import { resolveSettings } from '../src/config/resolveSettings.js';
// ...
it('applies line-level default colors through resolveSettings', () => {
  const settings = SettingsSchema.parse({
    style: 'powerline',
    lines: [{ defaults: { bg: '#654321' }, left: [{ type: 'model' }] }],
  });
  const ctx = /* build a ctx with a model display name */;
  const line = buildStatus(settings, ctx, 200);
  // the model segment must be colored with the line default bg (48;2;101;67;33)
  expect(line).toContain('48;2;101;67;33');
});
```

Fill `ctx` using the existing helper pattern in `test/pipeline.test.ts` (a `WidgetContext` with `status.model.display_name` set). If the file lacks one, construct inline:
```ts
const ctx = { status: { model: { display_name: 'M' } }, totals: ZERO_TOTALS, git: { branch: null } } as unknown as WidgetContext;
```
(import `ZERO_TOTALS` from `../src/transcript/parseTranscript.js`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run test/pipeline.test.ts`
Expected: FAIL — current pipeline ignores `line.defaults`, so the `#654321` bg is absent.

- [ ] **Step 3: Rewrite `pipeline.ts`**

```ts
// src/pipeline.ts
/**
 * Turn resolved settings + a widget context into the final status string.
 * Pure and width-parameterized, so it can be snapshot-tested without touching
 * stdin, the filesystem, or the terminal.
 */
import { renderBuiltin } from './render/builtinRenderer.js';
import { renderPowerline } from './render/powerlineRenderer.js';
import type { LineGroups, Segment } from './render/types.js';
import type { Settings } from './types/Settings.js';
import { resolveSettings, type ResolvedItem, type ResolvedLine } from './config/resolveSettings.js';
import { renderWidget } from './widgets/registry.js';
import type { WidgetContext } from './widgets/Widget.js';

function toSegment(item: ResolvedItem, ctx: WidgetContext): Segment {
  const text = renderWidget(item.type, ctx, item.options);
  return { text: text ?? '', fg: item.fg, bg: item.bg, hidden: text === null };
}

function toGroups(line: ResolvedLine, ctx: WidgetContext): LineGroups {
  return {
    left: line.left.map((item) => toSegment(item, ctx)),
    right: line.right.map((item) => toSegment(item, ctx)),
  };
}

/** Build the full (possibly multi-line) status string. */
export function buildStatus(settings: Settings, ctx: WidgetContext, width: number): string {
  const resolved = resolveSettings(settings);
  return resolved.lines
    .map((line) => {
      const groups = toGroups(line, ctx);
      return resolved.style === 'powerline'
        ? renderPowerline(groups, width, resolved.theme)
        : renderBuiltin(groups, { separator: resolved.separator });
    })
    .join('\n');
}
```

The renderers are untouched: segments now always carry concrete `fg`/`bg`, so the renderer's `?? theme.defaultFg` fallback is retained only as a defensive no-op (the cascade is authoritative). This keeps the diff minimal and the golden snapshots byte-identical.

- [ ] **Step 4: Run the full suite + golden snapshots**

Run: `node_modules/.bin/vitest run && node_modules/.bin/tsc --noEmit`
Expected: ALL pass, including `test/golden/render.test.ts` (byte-identical) and the new line-defaults test.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline.ts test/pipeline.test.ts
git commit -m "$(cat <<'EOF'
refactor: resolve settings before rendering

buildStatus now runs resolveSettings first, so the pipeline maps concrete
resolved items (colors from the cascade, typed options) into segments and the
renderers only draw. Line-level default colors take effect; golden snapshots
are byte-identical.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Derive the preview context from widget samples

**Files:**
- Modify: `src/cli/previewContext.ts` (rewrite as derivation + export `deepMerge`)
- Test: `test/cli/previewContext.test.ts` (NEW), `test/cli/init.test.ts` (existing — must stay green)

**Interfaces:**
- Consumes: `WIDGET_DEFS` from `src/widgets/registry.js`; `WidgetDef`, `WidgetContext`, `PartialContext` from `src/widgets/Widget.js`; `ZERO_TOTALS` from `src/transcript/parseTranscript.js`.
- Produces:
  - `function deepMerge<T>(base: T, patch: unknown): T`
  - `function previewContext(defs?: WidgetDef[]): WidgetContext` — defaults to `WIDGET_DEFS`.

- [ ] **Step 1: Write the failing tests**

```ts
// test/cli/previewContext.test.ts
import { describe, it, expect } from 'vitest';
import { previewContext, deepMerge } from '../../src/cli/previewContext.js';
import { renderWidget, WIDGET_DEFS } from '../../src/widgets/registry.js';
import type { WidgetDef } from '../../src/widgets/Widget.js';

describe('deepMerge', () => {
  it('recursively merges sibling keys without clobbering', () => {
    const merged = deepMerge({ git: { branch: 'x' } }, { git: { changes: { added: 1, deleted: 0 } } });
    expect(merged).toEqual({ git: { branch: 'x', changes: { added: 1, deleted: 0 } } });
  });
});

describe('previewContext derivation', () => {
  it('renders every widget that declares a sample to a non-null value', () => {
    const ctx = previewContext();
    for (const d of WIDGET_DEFS) {
      if (d.sample) {
        expect(renderWidget(d.type, ctx)).not.toBeNull();
      }
    }
  });

  it('reproduces the canonical preview values', () => {
    const ctx = previewContext();
    expect(renderWidget('model', ctx)).toBe('Opus 4.8');
    expect(renderWidget('directory', ctx)).toBe('~/D/w/voice-connect');
    expect(renderWidget('cache-hit-rate', ctx)).toBe('cache:90%');
    expect(renderWidget('cache-window', ctx)).toBe(`${'\u{f017}'} 4:43`);
    expect(renderWidget('session-cost', ctx)).toBe('$1.23');
  });

  it('auto-includes a newly registered widget in the preview (extensibility invariant)', () => {
    const fake: WidgetDef = {
      type: 'fake-xyz',
      options: WIDGET_DEFS[0]!.options,
      render: (c) => (c.status.session_id === 'sample-xyz' ? 'FAKE' : null),
      sample: () => ({ status: { session_id: 'sample-xyz' } }),
    };
    const ctx = previewContext([...WIDGET_DEFS, fake]);
    expect(fake.render(ctx, {})).toBe('FAKE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run test/cli/previewContext.test.ts`
Expected: FAIL — `deepMerge` not exported / preview not derived.

- [ ] **Step 3: Rewrite `previewContext.ts`**

```ts
// src/cli/previewContext.ts
/**
 * The `init` preview's mock render context, DERIVED from the widgets: each
 * widget contributes the slice of {@link WidgetContext} it needs via `sample()`,
 * and those slices are deep-merged onto a small cross-cutting base. Running the
 * real render path over this context means the preview can never drift from
 * production output, and a new widget shows up automatically.
 *
 * Cross-cutting values (`now`, `home`) live in the base; `now`/`cacheExpiresAt`
 * (contributed by cache-window) are chosen to show a stable ~4:43 countdown.
 */
import { ZERO_TOTALS } from '../transcript/parseTranscript.js';
import { WIDGET_DEFS } from '../widgets/registry.js';
import type { PartialContext, WidgetContext, WidgetDef } from '../widgets/Widget.js';

type Obj = Record<string, unknown>;

function isPlainObject(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Recursively merge `patch` onto `base`; objects merge, everything else overwrites. */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch === undefined ? base : (patch as T));
  }
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

function baseContext(): WidgetContext {
  return {
    status: {},
    totals: { ...ZERO_TOTALS },
    git: { branch: null },
    now: 17_000,
    home: '/Users/you',
  };
}

export function previewContext(defs: WidgetDef[] = WIDGET_DEFS): WidgetContext {
  return defs.reduce<WidgetContext>(
    (ctx, d) => deepMerge(ctx, (d.sample?.() ?? {}) as PartialContext),
    baseContext(),
  );
}
```

- [ ] **Step 4: Run the full suite**

Run: `node_modules/.bin/vitest run && node_modules/.bin/tsc --noEmit`
Expected: ALL pass. `test/cli/init.test.ts`'s `renderPreview` expectations are unchanged because the derived context reproduces the same values the hand-written blob held.

- [ ] **Step 5: Commit**

```bash
git add src/cli/previewContext.ts test/cli/previewContext.test.ts
git commit -m "$(cat <<'EOF'
refactor: derive init preview context from widget samples

previewContext is now built by deep-merging each widget's declared sample()
slice onto a cross-cutting base, then running the real render path. A new
widget appears in the preview automatically instead of requiring a hand-edit
to a decoupled mock blob. Values reproduce the prior preview exactly.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Cleanup and final verification

**Files:**
- Modify: `src/widgets/format.ts` (remove `optString` if unused)
- Modify: `test/widgets/format.test.ts` (drop `optString` cases if the function is removed)
- Modify: `README.md` if it documents the preview/mock mechanism

**Interfaces:**
- No new interfaces. This task removes dead code and verifies the whole suite + coverage.

- [ ] **Step 1: Find remaining `optString` usages**

Run: `grep -rn "optString" src test`
Expected: usages only in `src/widgets/format.ts` (definition) and possibly `test/widgets/format.test.ts`. Registry no longer uses it.

- [ ] **Step 2: Remove `optString` if unused in `src/`**

If the grep shows no `src/` usage other than the definition, delete the `optString` function from `src/widgets/format.ts` and delete its test cases from `test/widgets/format.test.ts`. If any `src/` file still imports it, leave it and skip this step.

- [ ] **Step 3: Run the full suite, typecheck, and coverage**

Run:
```bash
node_modules/.bin/vitest run
node_modules/.bin/tsc --noEmit
node_modules/.bin/vitest run --coverage
```
Expected: all tests pass; tsc clean; coverage ≥90% on changed files (`compose.ts`, `registry.ts`, `resolveSettings.ts`, `previewContext.ts`, `Settings.ts`, `pipeline.ts`). `Widget.ts` is type-only (0% expected, not a gap).

- [ ] **Step 4: Confirm golden snapshots untouched**

Run: `git diff --stat -- test/golden/`
Expected: no output — the snapshot files are byte-identical.

- [ ] **Step 5: Update README if needed**

If `README.md` describes the init preview as reading a hand-written fixture, update that paragraph to say the preview is derived from each widget's `sample()`. Otherwise skip.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: drop dead optString helper and finalize refactor

Remove optString now that widget options are typed and defaulted through
their Zod schemas. Full suite green, output byte-identical.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- Self-describing widgets (options schema + render + sample) → Task 2. ✓
- Composition helpers for shared behavior → Task 1. ✓
- Value cascade item → line → theme → builtin → Task 3 (schema) + Task 4 (resolver). ✓
- Per-widget typed options with degradation → Task 2 (`parseWidgetOptions`) + Task 4 (used in resolution). ✓
- Render layer consumes resolved config → Task 5. ✓
- Preview derived from samples, real render path, extensibility invariant → Task 6. ✓
- Byte-identical output → golden snapshots asserted in Tasks 5 & 7. ✓
- Cleanup of `optString` → Task 7. ✓
- Non-goal (no per-group cascade) respected: cascade stops at line level. ✓

**2. Placeholder scan:** The only placeholder was the intent-only `it` block in Task 2 Step 1, explicitly removed in Task 2 Step 5. The `ctx` fill-in in Task 5 Step 1 includes the concrete inline construction. No other TBD/TODO.

**3. Type consistency:** `WidgetDef`, `parseWidgetOptions`, `WIDGET_DEFS`, `ResolvedItem/ResolvedLine/ResolvedSettings`, `resolveSettings`, `previewContext`, `deepMerge` are named identically across the tasks that define and consume them. `renderWidget(type, ctx, options?)` signature is stable. Default glyph constants match the Global Constraints list.

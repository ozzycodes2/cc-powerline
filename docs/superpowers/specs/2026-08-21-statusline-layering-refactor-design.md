# Statusline layering refactor — design

Date: 2026-08-21
Status: Approved for implementation planning
Scope: `cc-powerline` render / config / TUI layers

## Problem

`cc-powerline` works (177 tests green) but three layers have blurred
responsibilities that make adding a widget error-prone and leave "defaults"
scattered across the codebase:

1. **Render layer** is mostly isolated, but widgets still apply theme-color
   fallbacks indirectly and the renderer re-resolves defaults at draw time
   (`s.fg ?? theme.defaultFg`).
2. **Config layer** has no real inheritance. Defaults live in three places:
   theme color fallbacks inside the renderer, per-widget option defaults
   hardcoded in each `render()` body (`optString(options, 'icon', ICON_X)`),
   and color rings in `presets.ts`.
3. **TUI preview** reads a single hand-maintained mock blob
   (`previewContext.ts`) that is fully decoupled from widget definitions.
   Adding a widget requires remembering to hand-edit the mock, or the widget
   shows nothing in the wizard preview.

## Goals

- Each widget is a **self-describing unit**: its typed options schema, its
  `render`, and its **mock context slice** all live in one place. Adding a
  widget is a one-file change; config and TUI derive everything else.
- **Config layer** performs a **value cascade** (item → line → theme →
  builtin), resolved once, and validates/defaults each widget's options through
  a per-widget Zod schema. Properly typed and extensible.
- **Render layer** stays pure: it consumes fully-resolved config + context and
  only formats. It no longer resolves defaults.
- **TUI preview** merges every widget's declared sample slice into one mock
  context, then runs the **real** render path — the preview cannot drift from
  production output.
- Shared widget behavior (icon/label prefix, hide-when-empty) comes from
  **composition helpers**, not copy-paste.

### Non-goals

- No change to render _output_ for any given settings — the existing golden
  snapshots must stay byte-identical.
- No per-group (left/right) cascade level. Cascade stops at the line level.
- No live/full-screen TUI. The wizard stays a numbered-choice prompt.
- No new widgets in this work; this is a structural refactor only.

## Constraints

- Behavior preserved: golden snapshots (`test/golden/*.snap.txt`) unchanged.
  All resolved defaults (icons, `brightWhite`/`gray`, separator glyphs) are
  pinned to today's values.
- House style preserved: pure functions, injectable dependencies, functional
  registry — no class hierarchy.
- Malformed config degrades to defaults rather than crashing (existing Zod
  philosophy in `Settings.ts`), extended to per-widget options.
- The project has no published users yet, so the on-disk schema may evolve as
  long as it stays backward-compatible with configs the current schema accepts.

## Design

### Layer diagram

```
                 widget defs (self-describing)
                 ├─ options schema (Zod, typed defaults)
                 ├─ render(ctx, opts)
                 └─ sample() ── context slice ─┐
                                               ▼
 Settings ─▶ config layer ─▶ ResolvedSettings ─▶ render layer ─▶ string
 (on disk)   resolveSettings   (concrete colors,     (pure format)
             (cascade +         typed options)
              option parse)
                                               ▲
                              preview: merge all sample() slices
                              into one WidgetContext, run real render
```

### Section 1 — Widget descriptor + composition

`src/widgets/Widget.ts` — the descriptor becomes generic over its options type:

```ts
export interface WidgetDef<O = unknown> {
  type: string;
  /** Zod schema for this widget's options; every field carries a .default(). */
  options: z.ZodType<O>;
  /** Pure: fully-resolved, typed options in; display text or null to hide. */
  render(ctx: WidgetContext, opts: O): string | null;
  /** Deep-partial mock slice contributed to the TUI preview context. */
  sample?(): PartialContext;
}
```

- `PartialContext` = a deep-partial of `WidgetContext`.
- Option defaults move **out of** `render()` bodies and **into** the schema:
  `icon: z.string().default('')`. Parsing `{}` yields the defaults, so
  `optString(...)` reaching into an untyped bag goes away.
- `defineWidget<O>(def): WidgetDef<O>` — a light factory that gives type
  inference and a single well-formedness point for registry entries.

`src/widgets/compose.ts` (NEW) — shared behavior via composition:

- `hideWhenEmpty(core)` — returns `null` when the core value is null/empty.
- `prefixIcon(core)` — reads `opts.icon`; emits `${icon} ${body}` when the icon
  is non-empty, else the bare body.
- `prefixLabel(core, sep)` — reads `opts.label`; joins with `' '` or `':'`
  depending on `sep` (matches the existing space-join vs colon-join widgets).

A widget's `render` is composed, e.g.
`render: prefixIcon((ctx, opts) => coreValue(ctx))`.

### Section 2 — Config layer: cascade + resolution

`src/config/resolveSettings.ts` (NEW), pure:

```ts
export interface ResolvedItem {
  type: string;
  fg: Color; // resolved via cascade
  bg: Color; // resolved via cascade
  options: unknown; // parsed + defaulted via the widget's Zod schema
}
export interface ResolvedSettings {
  style: 'powerline' | 'builtin';
  separator?: string;
  theme: ResolvedTheme; // separators + (defaults already folded in)
  lines: { left: ResolvedItem[]; right: ResolvedItem[] }[];
}
export function resolveSettings(settings: Settings): ResolvedSettings;
```

- **Value cascade** for `fg`/`bg`, first non-undefined wins:
  `item.fg → line.defaults?.fg → theme.defaultFg → BUILTIN_DEFAULT.fg`.
  `BUILTIN_DEFAULT` pins today's values (`brightWhite` fg, `gray` bg) so output
  is unchanged.
- `LineConfigSchema` gains an optional `defaults?: { fg?: Color; bg?: Color }`
  (back-compatible; absent in every current config).
- **Options** resolved per item: `widget.options.safeParse(item.options ?? {})`;
  on failure fall back to `widget.options.parse({})` (defaults). Unknown widget
  `type` → the item is dropped, as today.
- Theme separators resolved once here too, so the renderer receives a fully
  concrete theme.

### Section 3 — Render layer, preview, pipeline

- `src/pipeline.ts:buildStatus` calls `resolveSettings(settings)` first, maps
  `ResolvedItem`s to `Segment`s (colors already concrete, options already
  typed), and passes them to `renderPowerline` / `renderBuiltin`.
- `src/render/powerlineRenderer.ts` + `builtinRenderer.ts` drop the
  `?? theme.defaultFg` color fallback (colors arrive concrete). They keep
  separator handling. Defensive fallbacks may remain as no-ops if it keeps the
  diff small, but the cascade is the single source of truth.
- `src/cli/previewContext.ts` becomes **derived**:

```ts
export function previewContext(defs = ALL): WidgetContext {
  const base = baseSampleContext(); // now, home, model scaffold (cross-cutting)
  return defs.reduce((ctx, d) => deepMerge(ctx, d.sample?.() ?? {}), base);
}
```

Cross-cutting fields (`now`, `home`, model display name) live in the base;
widget-specific fields come from each `sample()`. cache-window's `sample()`
contributes `cacheExpiresAt`; the base supplies `now`. The current constants
(`now = 17_000`, `cacheExpiresAt = 300_000`) are preserved so the `4:43`
countdown — and its test — stay stable.

- `src/cli/init.ts` is essentially unchanged: `renderPreview` still calls
  `buildStatus(settings, previewContext(), width)`.

### Format helpers

`src/widgets/format.ts` helpers stay where still used (`compressPath`,
`formatDuration`, `formatCost`, `formatPercent`, `basename`). `optString`
becomes redundant once options are typed; remove it if no callers remain.

## Testing

- **Golden snapshots** (`test/golden/*`) unchanged — the byte-identical proof.
- `resolveSettings`: cascade precedence, each level winning in turn; line
  `defaults` applied; unknown type dropped; invalid options degrade to defaults.
- Per-widget option schemas: `{}` yields documented defaults; bad values
  degrade.
- Composition helpers: `prefixIcon` / `prefixLabel` / `hideWhenEmpty` in
  isolation.
- Preview derivation: every widget's slice present in `previewContext()`; an
  **invariant test** registers a throwaway widget with a `sample()` and asserts
  it appears in the preview automatically (guards the "add a widget → preview
  updates" contract).
- Update existing tests that referenced the old `Widget` shape / hardcoded
  option defaults / hand-written preview context.
- ≥90% coverage on new/changed code (`vitest run --coverage`).

## Files touched

| File                                                    | Change                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/widgets/Widget.ts`                                 | Descriptor → `WidgetDef<O>` with `options` + `sample`; add `PartialContext`, `defineWidget`. |
| `src/widgets/compose.ts`                                | NEW — `hideWhenEmpty`, `prefixIcon`, `prefixLabel`.                                          |
| `src/widgets/registry.ts`                               | Rewritten as `defineWidget` entries; option defaults in schemas; add `sample()` per widget.  |
| `src/config/resolveSettings.ts`                         | NEW — cascade + option resolution → `ResolvedSettings`.                                      |
| `src/types/Settings.ts`                                 | Add optional `LineConfig.defaults`; keep back-compat.                                        |
| `src/pipeline.ts`                                       | Resolve settings first; segments carry concrete colors + typed options.                      |
| `src/render/powerlineRenderer.ts`, `builtinRenderer.ts` | Consume concrete colors; drop default-resolution.                                            |
| `src/cli/previewContext.ts`                             | Derive from registry `sample()` slices + base context.                                       |
| `src/cli/init.ts`                                       | Unchanged apart from any type ripples.                                                       |
| `test/**`                                               | New tests above; update tests coupled to old shapes.                                         |

## Risks / watch-outs

- **Byte-identical output** is the acceptance bar. Pin every default (icons,
  colors, separators) to current values; rely on golden snapshots to catch
  drift.
- **Deep-merge semantics** for preview slices must be a real recursive merge so
  two widgets contributing sibling keys under `totals`/`status` don't clobber
  each other.
- **Option parse degradation** must never throw into the render path — a bad
  option key should fall back silently, consistent with the settings loader.
- `optString` removal: verify no stragglers before deleting.

## Open questions

None — design approved 2026-08-21.

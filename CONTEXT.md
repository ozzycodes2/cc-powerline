# cc-powerline — domain language

Shared vocabulary for the statusline's config and render layers. Names here are
the load-bearing seams; use them exactly in code and discussion.

## Config

- **Settings** — the whole user configuration: a render style plus, per line, a
  left and right widget group. The on-disk schema (`types/Settings.ts`).
- **Widget item** — one entry in a group: a widget `type`, optional `fg`/`bg`,
  and optional per-widget `options`.
- **Palette** — a foreground plus a ring of backgrounds, applied round-robin
  across the widgets in a group. The pure, applyable color unit
  (`config/palette.ts`).
- **Preset** — a _named, selectable_ palette: a built-in (slate / mono / ocean)
  or a theme detected from the user's existing prompt config on disk. A palette
  with a `key` and `label`.
- **Resolved settings** — Settings with every fg/bg cascade applied and every
  widget's options parsed; the concrete instruction the render layer draws from
  (`config/resolveSettings.ts`).

## Editing

- **Settings algebra** — the pure `Settings → Settings` edit operations (add /
  move / remove a widget, recolor, apply a palette, line ops). One home that
  both frontends drive (`config/edit.ts`).
- **Frontend** — a way to build or edit Settings: the numbered-prompt `init`
  wizard (`cli/`) and the Ink TUI editor (`tui/`). Frontends are _adapters_ over
  the Settings algebra and the config store.
- **Config store** — the seam that reads and writes Settings on disk
  (`config/store.ts`).

## Render

- **SGR** — the ANSI escape family the render layer emits and, when a consumer
  needs one attribute per escape, expands (`render/sgr.ts`).

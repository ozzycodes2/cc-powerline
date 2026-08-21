# cc-powerline

A precise-cost, powerline-capable statusline for [Claude Code](https://claude.com/claude-code).

Two things set it apart from a generic statusline:

1. **Precise session cost.** It does **not** pass through Claude Code's
   reported `cost.total_cost_usd`. It re-derives spend from the transcript
   using the same real per-token pricing formula as
   [ccusage](https://github.com/ccusage/ccusage) — 5-minute vs. 1-hour
   cache-creation split, long-context (200k) tiering, LiteLLM pricing — so the
   number matches what you'll actually be billed.
2. **Exactly two render styles.** A true **powerline** style (left- and
   right-anchored segment groups joined by arrow separators) and Claude Code's
   plain **builtin** single-line style. No 60-widget zoo, no gradient themes —
   just the two layouts people actually use.

## Install

```bash
npm install -g cc-powerline   # scope TBD before first publish — see "Publishing"
```

Or run without installing:

```bash
npx cc-powerline init
```

## Wire it into Claude Code

Add a `statusLine` hook to `~/.claude/settings.json` pointing at the binary:

```json
{
  "statusLine": {
    "type": "command",
    "command": "cc-powerline"
  }
}
```

Claude Code pipes the session status as JSON on stdin and renders whatever the
command writes to stdout. cc-powerline never throws: on any internal error it
emits an empty line rather than a stack trace, so a bad config or a missing
pricing file can never break your prompt.

## Configure

Run the interactive wizard:

```bash
cc-powerline init
```

It walks through render style → left widgets → right widgets (skipped for the
builtin style) → color preset, then writes the result to:

```
${XDG_CONFIG_HOME:-~/.config}/cc-powerline/settings.json
```

`cc-powerline config path` prints that location.

### Config schema

```jsonc
{
  // "powerline" (default) or "builtin"
  "style": "powerline",

  // builtin-only: string placed between segments (default two spaces)
  "separator": "  ",

  // powerline-only: override the arrow glyphs / default colors
  "theme": {
    "separator": "",
    "rightSeparator": "",
    "defaultFg": "brightWhite",
    "defaultBg": "#2d3142"
  },

  // one entry per output line; each has a left and right widget group
  "lines": [
    {
      "left": [
        { "type": "model", "fg": "brightWhite", "bg": "#2d3142" },
        { "type": "git-branch", "fg": "brightWhite", "bg": "#4f5d75" },
        { "type": "directory", "fg": "brightWhite", "bg": "#3d5a80" }
      ],
      "right": [
        { "type": "context-length", "fg": "brightWhite", "bg": "#5c6b73" },
        { "type": "cache-hit-rate", "fg": "brightWhite", "bg": "#6d597a" },
        { "type": "session-cost", "fg": "black", "bg": "#2a9d8f" }
      ]
    }
  ]
}
```

- **Colors** are either one of the 16 ANSI names (`black`, `red`, …,
  `brightWhite`) or a `#rrggbb` hex string (rendered as 24-bit truecolor).
- The **builtin** style ignores the `right` group entirely. If you configure
  a right group under `builtin`, a one-time warning tells you to move those
  widgets to `left` or switch to `powerline`.
- A malformed config degrades to the built-in defaults rather than failing.

### Widgets

| type             | shows                                                        |
| ---------------- | ------------------------------------------------------------ |
| `model`          | model display name (falls back to id)                        |
| `model-effort`   | reasoning-effort level (e.g. `high`); `options.icon`         |
| `git-branch`     | current branch (hidden outside a repo); `options.icon`       |
| `git-changes`    | working-tree churn `+added -deleted` vs. HEAD; `options.icon`|
| `directory`      | working directory; `options.mode` = `compressed` (default, powerline `~/D/w/proj`), `basename`, or `full` |
| `context-length` | percent of the context window used; `options.label`          |
| `session-cost`   | precise running cost from the transcript                     |
| `cache-hit-rate` | cache-read share of all cache tokens; `options.label`        |
| `cache-window`   | countdown to prompt-cache (5m/1h) expiry; `options.icon`     |
| `compactions`    | count of compaction events this session; `options.icon`      |
| `rate-limit`     | 5-hour usage percentage; `options.label`                     |
| `separator`      | a literal separator string; `options.char`                   |

Icon-bearing widgets default to Nerd Font glyphs; every one is overridable via
`options.icon` (set it to `""` to drop the icon). Any widget that has nothing
to show (no branch, no rate-limit data, an expired cache window, zero
compactions, etc.) is omitted from the line rather than rendered blank.

### Color presets

The wizard offers `slate` (default), `mono`, and `ocean`. A preset is just a
foreground plus a ring of backgrounds applied round-robin across each group's
widgets — a fast way to get a coherent palette without hand-picking colors.

## Pricing

Pricing comes from LiteLLM's public price table, resolved in this order:

1. On-disk cache at `${XDG_CACHE_HOME:-~/.cache}/cc-powerline/litellm-pricing.json`
   (fresh within 24h).
2. A network fetch (then cached).
3. A stale cache, if the network is unavailable.
4. An embedded Anthropic-only snapshot shipped with the package.

Force a refresh with `cc-powerline pricing refresh`; inspect the resolved
source or a single model's rates with `cc-powerline pricing show [--model <name>]`.

A model missing from the table costs `0.0` (silently) — the statusline never
guesses.

## CLI

```
cc-powerline                     # (invoked by Claude Code) render a status line from stdin
cc-powerline init                # interactive config wizard
cc-powerline config path         # print the settings file path
cc-powerline pricing refresh     # fetch + cache the latest LiteLLM pricing
cc-powerline pricing show        # show the resolved pricing source
cc-powerline pricing show --model <name>   # show one model's rates
```

## Develop

```bash
npm install
npm test           # vitest
npm run coverage   # vitest + v8 coverage
npm run typecheck  # tsc --noEmit
npm run build      # tsup → dist/
```

Golden snapshot tests under `test/golden/` render a fixed fixture through both
styles at 80 columns and compare byte-for-byte; regenerate them deliberately
with `npx vitest -u` after an intentional rendering change.

## Publishing

The package name is currently the placeholder `@cc-powerline/cc-powerline`.
Finalize the real npm scope in `package.json` before the first
`npm publish`. `prepublishOnly` runs the build so `dist/` is always fresh.

## License

MIT

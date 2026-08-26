# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.10] - 2026-08-26

### Documentation

- Re-release so the README images on npm resolve to the regenerated,
  sanitized panel captures. npm rewrites the README's relative image paths
  against the `gitHead` recorded at publish time, and 0.2.9 was cut one
  commit before the assets were re-captured, so its package page still
  showed the old screenshots. No code changes from 0.2.9.

## [0.2.9] - 2026-08-26

### Fixed

- The preview's sample directory no longer shows a private downstream
  project name. It was hardcoded into the mock render context and surfaced
  verbatim in the init wizard's live preview and the golden fixtures; it now
  reads as the project's own name. The README image assets are baked
  screenshots and will show the new name once they are re-captured.

## [0.2.8] - 2026-08-26

### Security

- The statusline no longer runs its git and terminal-width probes through a
  shell. It previously built commands by interpolating the working directory
  into a string passed to `execSync`, so a directory whose name contained shell
  metacharacters (`$(…)`, backticks, `;`) would execute rather than be treated
  as a path — rendering the status line inside a maliciously named directory was
  enough to run arbitrary commands. Both probes now use `execFileSync` with an
  argv array, so paths reach `git`/`stty`/`tput` as inert data.

### Documentation

- Added `SECURITY.md` (private vulnerability reporting plus a threat model),
  `CONTRIBUTING.md`, and a Dependabot config that watches npm and GitHub Actions
  dependencies weekly.

## [0.2.7] - 2026-08-25

### Added

- A `total-tokens` widget shows the running total of all tokens consumed this
  session — input, output, and both cache streams (read and creation) summed —
  compacted to `k`/`M` with a single decimal (`84.3k`, `1.2M`). Like the other
  usage widgets it hides itself at zero. Add it from the `init` widget picker.

## [0.2.6] - 2026-08-25

### Documentation

- The README now shows the `init` editor in action: an animated walkthrough GIF
  plus stills of the style, widgets, theme, and Claude Code wiring panels. The
  assets are generated from a checked-in [VHS](https://github.com/charmbracelet/vhs)
  tape (`docs/tapes/init-walkthrough.tape`) that isolates `HOME`,
  `XDG_CONFIG_HOME`, and `CLAUDE_CONFIG_DIR` into temp dirs, so anyone can
  regenerate them after a TUI change with `vhs docs/tapes/init-walkthrough.tape`.

## [0.2.5] - 2026-08-25

### Changed

- Auto-contrast now computes a softened foreground instead of snapping to pure
  black or bright white. It solves for the neutral gray whose WCAG contrast
  ratio against the segment background lands at the AAA target (7:1), so text is
  readable without the harsh pure-white glare that did not match themed prompts.
  Backgrounds where 7:1 is physically unreachable clamp to black/white (maximum
  contrast). The result is a `#rrggbb` gray baked in at palette-apply time, exact
  for hex backgrounds and approximated through the xterm-default palette for the
  16 named colors. Re-pick your theme in the Theme panel to repaint an
  already-saved config.

## [0.2.4] - 2026-08-25

### Added

- The `git-branch` widget now signals the git state with its icon: a linked
  worktree, the `main`/`master` branch, or any other branch each get a distinct
  glyph. Worktree state wins over the branch name (being outside the main
  checkout is the more notable state, even on a `main` worktree). The three
  glyphs are configurable via the widget's `icon`, `mainIcon`, and
  `worktreeIcon` options; set any to `""` to drop that state's prefix.

### Fixed

- The per-widget color picker grid was misaligned: cells used only a right
  margin, so the ragged color-name widths (`red` through `brightMagenta`)
  pushed every column out of line. Cells are now fixed width with padded
  labels, so the caret, swatch, and name line up across rows.

## [0.2.3] - 2026-08-25

### Fixed

- Auto-contrast still picked unreadable foregrounds for the normal named colors.
  Contrast was judged against dim SGR half-values (`yellow` as `[128,128,0]`),
  but terminals paint those colors far brighter, so bright yellow/cyan segments
  got white text, and a YIQ threshold left saturated greens white too. Contrast
  now uses the real xterm palette RGB and WCAG relative luminance, so `yellow`,
  `green`, and `cyan` backgrounds take dark text. Re-pick your theme to repaint
  an already-saved config — the foreground is baked in at apply time.
- The powerline right group was clipped inside Claude Code. Claude Code renders
  the status line with its own horizontal chrome, so drawing to the full
  detected width overflowed the visible edge. The render width now reserves a
  few columns for that chrome; `CC_POWERLINE_WIDTH` still forces an exact width.

## [0.2.2] - 2026-08-25

### Fixed

- Applying an imported prompt theme (Powerlevel10k, oh-my-posh, Powerline) left
  segments with unreadable foregrounds — the theme parsers keep only each
  segment's background and a single hardcoded `brightWhite` was painted on every
  widget, so light backgrounds in the ring (white, bright yellow) rendered as
  white-on-white. Foreground is now chosen per segment for contrast against its
  background (dark text on light backgrounds, light text on dark), so any
  imported palette stays legible. Built-in presets are unaffected. Re-pick your
  theme in the Theme panel to repaint an already-saved config.

## [0.2.1] - 2026-08-25

### Fixed

- The post-save "wire into Claude Code?" confirmation was unusable in the
  interactive editor. It ran as a readline prompt after Ink had already torn
  down the terminal, so it never rendered in place — the question only surfaced,
  broken, after quitting, leaving the terminal blocked on input. The
  confirmation is now a screen inside the TUI: saving an unwired config opens it
  (offered once per session, skipped when Claude Code already points at
  cc-powerline), and answering returns to the main menu with the outcome shown.
  The non-interactive (`--no-tui` / piped) path keeps its readline prompt, which
  never conflicted with Ink.

### Added

- `cc-powerline init` now wires itself into Claude Code. After saving your
  config it offers (default yes; auto-yes when non-interactive) to add the
  `statusLine` hook to `${CLAUDE_CONFIG_DIR:-~/.claude}/settings.json`,
  preserving every other setting and replacing any existing statusLine. A
  settings file it can't parse is reported with the manual snippet, never
  overwritten. This removes the manual JSON-editing step the README required.

## [0.1.2] - 2026-08-25

### Fixed

- The statusline never rendered through the documented wiring. `cc-powerline`
  (the only binary) is `cli.js`, but `cli.js` had no statusline behavior — the
  renderer lived in `index.js`, which was not exposed as a bin. Pointing Claude
  Code's `statusLine.command` at `cc-powerline` therefore produced nothing.
  `cli.js` now renders the statusline itself when invoked with no subcommand and
  a piped stdin, delegating to the statusline library; subcommands and an
  interactive (TTY) invocation are unaffected (the latter now prints help).
- `cc-powerline --version` reported a hardcoded `0.1.0` that drifted from the
  real version. It is now read from `package.json`.

### Changed

- `index.js` is now a pure library (no self-executing entry guard); the CLI is
  the sole executable. Consumers importing the package are unaffected.

## [0.1.1] - 2026-08-25

### Fixed

- CLI commands did nothing when the package was installed from npm. The entry
  guard checked `process.argv[1].endsWith('cli.js')`, but npm invokes the CLI
  through a bin symlink named `cc-powerline`, so `main()` never ran and every
  command (`init`, `--help`, ...) silently exited 0. The entry point is now
  detected by resolving `argv[1]` and the module path through `realpathSync`,
  which sees through the symlink for global installs, `npx`, and direct runs.

## [0.1.0] - 2026-08-25

### Added

- Initial release of `cc-powerline`, a precise-cost, powerline-capable
  statusline for Claude Code.
- Two render styles: a true powerline layout (left/right-anchored segment
  groups with arrow separators) and Claude Code's builtin single-line style.
- Precise session cost derived from the transcript using real per-token
  LiteLLM pricing (5m vs. 1h cache-creation split, long-context tiering).
- Interactive configuration wizard (`cc-powerline init`) and an Ink TUI
  config editor.
- Pricing cache management (`cc-powerline pricing refresh|show`) with a
  network-with-fallback resolution chain and an embedded snapshot.
- Widget set: model, model-effort, git-branch, git-changes, directory,
  context-length, session-cost, cache-hit-rate, cache-window, compactions,
  rate-limit, and separator.

[Unreleased]: https://github.com/ozzycodes2/cc-powerline/compare/v0.2.6...HEAD
[0.2.6]: https://github.com/ozzycodes2/cc-powerline/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/ozzycodes2/cc-powerline/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/ozzycodes2/cc-powerline/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/ozzycodes2/cc-powerline/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/ozzycodes2/cc-powerline/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/ozzycodes2/cc-powerline/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ozzycodes2/cc-powerline/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/ozzycodes2/cc-powerline/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/ozzycodes2/cc-powerline/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ozzycodes2/cc-powerline/releases/tag/v0.1.0

# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/ozzycodes2/cc-powerline/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/ozzycodes2/cc-powerline/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/ozzycodes2/cc-powerline/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/ozzycodes2/cc-powerline/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ozzycodes2/cc-powerline/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/ozzycodes2/cc-powerline/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/ozzycodes2/cc-powerline/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ozzycodes2/cc-powerline/releases/tag/v0.1.0

# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/ozzycodes2/cc-powerline/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ozzycodes2/cc-powerline/releases/tag/v0.1.0

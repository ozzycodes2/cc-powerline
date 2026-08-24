#!/usr/bin/env bash
#
# Run cc-powerline against a throwaway XDG home so it never touches your real
# ~/.config, ~/.cache, or ~/.claude/settings.json.
#
# Usage:
#   scripts/sandbox.sh render [powerline|builtin]   # render every widget (default: both)
#   scripts/sandbox.sh init                          # run the wizard into the sandbox
#   scripts/sandbox.sh shell                         # print exports to source into your shell
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SANDBOX="$(mktemp -d "${TMPDIR:-/tmp}/cc-powerline-sandbox.XXXXXX")"

export XDG_CONFIG_HOME="$SANDBOX/config"
export XDG_CACHE_HOME="$SANDBOX/cache"
# Pin the preview to the real terminal width so it fills the window. The CLI's
# own detection reads process.stdout.columns, which several terminals report as
# 0 under a pty — it then falls back to an 80-column default and the line hugs
# the left of a wide terminal. Bash can query the controlling tty directly, so
# measure it here and hand it to the CLI via CC_POWERLINE_WIDTH (its
# top-priority width override). An explicit CC_POWERLINE_WIDTH still wins.
if [[ -z "${CC_POWERLINE_WIDTH:-}" ]]; then
  # `tput cols` reports the live width when stdout is the terminal (the usual
  # case); fall back to the controlling tty when stdout is redirected. Both are
  # best-effort — failures leave CC_POWERLINE_WIDTH unset and the CLI defaults.
  term_cols="$(tput cols 2>/dev/null || true)"
  if ! [[ "$term_cols" =~ ^[0-9]+$ ]]; then
    term_cols="$( { stty size </dev/tty; } 2>/dev/null | awk '{print $2}' )" || true
  fi
  [[ "$term_cols" =~ ^[0-9]+$ ]] && export CC_POWERLINE_WIDTH="$term_cols"
fi
mkdir -p "$XDG_CONFIG_HOME/cc-powerline" "$XDG_CACHE_HOME/cc-powerline"

cleanup() { rm -rf "$SANDBOX"; }
trap cleanup EXIT

if [[ ! -f "$ROOT/dist/index.js" ]]; then
  echo "dist/ not built — running 'npm run build'..." >&2
  (cd "$ROOT" && npm run build >/dev/null)
fi

render() { # $1 = style
  echo "--- style: $1 (width ${CC_POWERLINE_WIDTH:-auto}) ---"
  # `preview` renders every widget over shared mock data, so widgets that would
  # hide against a sparse fixture (git, cache, rate-limit) all show up. Width
  # comes from the CC_POWERLINE_WIDTH measured above.
  node "$ROOT/dist/cli.js" preview --style "$1"
  echo
}

cmd="${1:-render}"
case "$cmd" in
  render)
    style="${2:-}"
    if [[ -n "$style" ]]; then render "$style"; else render powerline; render builtin; fi
    ;;
  init)
    # `init` renders its own mock-data preview at the CC_POWERLINE_WIDTH measured
    # above, so it fills the terminal like `render`. No fixture re-render here.
    node "$ROOT/dist/cli.js" init
    ;;
  shell)
    trap - EXIT  # keep the sandbox alive for an interactive session
    echo "export XDG_CONFIG_HOME=$XDG_CONFIG_HOME"
    echo "export XDG_CACHE_HOME=$XDG_CACHE_HOME"
    [[ -n "${CC_POWERLINE_WIDTH:-}" ]] && echo "export CC_POWERLINE_WIDTH=$CC_POWERLINE_WIDTH"
    echo "# sandbox left at $SANDBOX (delete when done)"
    ;;
  *)
    echo "usage: $0 [render [powerline|builtin] | init | shell]" >&2
    exit 2
    ;;
esac

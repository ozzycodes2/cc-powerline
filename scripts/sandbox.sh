#!/usr/bin/env bash
#
# Run cc-powerline against a throwaway XDG home so it never touches your real
# ~/.config, ~/.cache, or ~/.claude/settings.json.
#
# Usage:
#   scripts/sandbox.sh render [powerline|builtin]   # render the fixture (default: both)
#   scripts/sandbox.sh init                          # run the wizard into the sandbox
#   scripts/sandbox.sh shell                         # print exports to source into your shell
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SANDBOX="$(mktemp -d "${TMPDIR:-/tmp}/cc-powerline-sandbox.XXXXXX")"
FIXTURE="$ROOT/test/fixtures/statusline-basic.json"

export XDG_CONFIG_HOME="$SANDBOX/config"
export XDG_CACHE_HOME="$SANDBOX/cache"
export CC_POWERLINE_WIDTH="${CC_POWERLINE_WIDTH:-80}"
mkdir -p "$XDG_CONFIG_HOME/cc-powerline" "$XDG_CACHE_HOME/cc-powerline"

cleanup() { rm -rf "$SANDBOX"; }
trap cleanup EXIT

if [[ ! -f "$ROOT/dist/index.js" ]]; then
  echo "dist/ not built — running 'npm run build'..." >&2
  (cd "$ROOT" && npm run build >/dev/null)
fi

write_settings() { # $1 = style
  cat >"$XDG_CONFIG_HOME/cc-powerline/settings.json" <<JSON
{
  "style": "$1",
  "lines": [
    {
      "left": [
        { "type": "model", "fg": "brightWhite", "bg": "#2d3142" },
        { "type": "directory", "fg": "brightWhite", "bg": "#3d5a80" },
        { "type": "context-length", "fg": "brightWhite", "bg": "#5c6b73" },
        { "type": "session-cost", "fg": "black", "bg": "#2a9d8f" }
      ],
      "right": [
        { "type": "context-length", "fg": "brightWhite", "bg": "#5c6b73" },
        { "type": "session-cost", "fg": "black", "bg": "#2a9d8f" }
      ]
    }
  ]
}
JSON
}

render() { # $1 = style
  write_settings "$1"
  echo "--- style: $1 (width $CC_POWERLINE_WIDTH) ---"
  node "$ROOT/dist/index.js" <"$FIXTURE"
  echo
}

cmd="${1:-render}"
case "$cmd" in
  render)
    style="${2:-}"
    if [[ -n "$style" ]]; then render "$style"; else render powerline; render builtin; fi
    ;;
  init)
    # `init` prints its own mock-data preview, so no fixture re-render here.
    node "$ROOT/dist/cli.js" init
    echo
    echo "Wrote to $XDG_CONFIG_HOME/cc-powerline/settings.json:"
    cat "$XDG_CONFIG_HOME/cc-powerline/settings.json"
    echo
    ;;
  shell)
    trap - EXIT  # keep the sandbox alive for an interactive session
    echo "export XDG_CONFIG_HOME=$XDG_CONFIG_HOME"
    echo "export XDG_CACHE_HOME=$XDG_CACHE_HOME"
    echo "export CC_POWERLINE_WIDTH=$CC_POWERLINE_WIDTH"
    echo "# sandbox left at $SANDBOX (delete when done)"
    ;;
  *)
    echo "usage: $0 [render [powerline|builtin] | init | shell]" >&2
    exit 2
    ;;
esac

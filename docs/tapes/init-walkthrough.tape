# cc-powerline init — end-to-end walkthrough.
#
# Regenerate the README assets (GIF + panel stills) with:
#   npm run build && vhs docs/tapes/init-walkthrough.tape
#
# Run from the repo root. The hidden setup below isolates HOME, the config
# dir, and Claude Code's settings dir into throwaway temp dirs, so recording
# never touches your real config and the Theme panel shows a deterministic set
# of built-in presets (prompt-theme detection is turned off for the capture).

Output "docs/media/init-walkthrough.gif"

Set Shell bash
Set FontFamily "MesloLGS NF"
Set FontSize 16
Set Width 1200
Set Height 460
Set Padding 20
# Fabric Dusk from fabric-theme v0.2.3, the palette the default preset uses.
Set Theme {"name":"Fabric Dusk","black":"#212324","red":"#e04a3c","green":"#8db05a","yellow":"#f0b92a","blue":"#6f93c0","purple":"#c08a9a","cyan":"#6aaea6","white":"#d0d6e0","brightBlack":"#8a8f98","brightRed":"#e66b60","brightGreen":"#a0bd75","brightYellow":"#f3c44f","brightBlue":"#8aa8cc","brightPurple":"#cfa5b2","brightCyan":"#84bdb6","brightWhite":"#f7f8f8","background":"#101214","foreground":"#f7f8f8","selection":"#ff6a13","cursor":"#ff6a13"}
Set TypingSpeed 90ms

Hide
Type "export HOME=$(mktemp -d) XDG_CONFIG_HOME=$(mktemp -d) CLAUDE_CONFIG_DIR=$(mktemp -d)"
Enter
Type "unset POSH_THEME"
Enter
Type 'cc-powerline() { node dist/cli.js "$@"; }'
Enter
Type "clear"
Enter
Show

Type "cc-powerline init"
Enter
Sleep 2s

# --- Render style ---------------------------------------------------------
Down
Sleep 600ms
Enter
Sleep 1s
Screenshot "docs/media/style-panel.png"
Down
Sleep 1200ms
Up
Sleep 500ms
Enter
Sleep 500ms
Escape
Sleep 800ms

# --- Lines & widgets ------------------------------------------------------
Enter
Sleep 1s
Enter
Sleep 1s
Screenshot "docs/media/widgets-panel.png"
Type "m"
Sleep 800ms
Down
Sleep 900ms
Down
Sleep 900ms
Enter
Sleep 900ms
Escape
Sleep 500ms
Escape
Sleep 800ms

# --- Theme ----------------------------------------------------------------
Down
Sleep 300ms
Down
Sleep 500ms
Enter
Sleep 1s
Screenshot "docs/media/theme-panel.png"
Down
Sleep 900ms
Enter
Sleep 1400ms
Escape
Sleep 800ms

# --- Save + auto-wire into Claude Code ------------------------------------
Ctrl+S
Sleep 2500ms
Screenshot "docs/media/wire-panel.png"
Enter
Sleep 1600ms

# --- Quit -----------------------------------------------------------------
Type "q"
Sleep 1s

/**
 * A palette is the config layer's color unit: a shared foreground plus a ring of
 * backgrounds cycled across the widgets in a group. `applyPalette` is the single
 * place that paints a Settings from one, so every frontend — the wizard, the TUI
 * reducer, a detected theme — recolors identically instead of re-deriving the
 * round-robin.
 */
import type { Color } from '../render/types.js';
import type { Settings, WidgetItem } from '../types/Settings.js';
import { readableFg } from '../render/colors.js';

/** A foreground plus a background ring, cycled across each group's widgets. */
export interface Palette {
  fg: Color;
  bgs: Color[];
}

/** A named, selectable palette: a built-in preset or a theme detected on disk. */
export interface Preset extends Palette {
  key: string;
  label: string;
}

/**
 * Paint every widget from `palette`: a per-group round-robin over `bgs` (each
 * group restarts at `bgs[0]`, so a line always leads with the palette's first
 * color) and, for each painted background, a foreground chosen for contrast
 * against it. Auto-contrast keeps imported prompt themes legible — their rings
 * often mix light and dark backgrounds, and a single shared fg would leave the
 * light ones with unreadable white-on-white text. An empty ring leaves bg (and
 * so the palette's `fg`) untouched. Pure.
 */
export function applyPalette(settings: Settings, palette: Palette): Settings {
  const paint = (group: WidgetItem[]): WidgetItem[] =>
    group.map((item, i) => {
      if (palette.bgs.length === 0) {
        return { ...item, fg: palette.fg, bg: item.bg };
      }
      const bg = palette.bgs[i % palette.bgs.length]!;
      return { ...item, fg: readableFg(bg), bg };
    });
  return {
    ...settings,
    lines: settings.lines.map((line) => ({
      ...line,
      left: paint(line.left),
      right: paint(line.right),
    })),
  };
}

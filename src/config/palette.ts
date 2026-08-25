/**
 * A palette is the config layer's color unit: a shared foreground plus a ring of
 * backgrounds cycled across the widgets in a group. `applyPalette` is the single
 * place that paints a Settings from one, so every frontend — the wizard, the TUI
 * reducer, a detected theme — recolors identically instead of re-deriving the
 * round-robin.
 */
import type { Color } from '../render/types.js';
import type { Settings, WidgetItem } from '../types/Settings.js';

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
 * Paint every widget from `palette`: the shared fg on each item, and a
 * per-group round-robin over `bgs` (each group restarts at `bgs[0]`, so a line
 * always leads with the palette's first color). An empty ring leaves bg
 * untouched. Pure.
 */
export function applyPalette(settings: Settings, palette: Palette): Settings {
  const paint = (group: WidgetItem[]): WidgetItem[] =>
    group.map((item, i) => ({
      ...item,
      fg: palette.fg,
      bg: palette.bgs.length === 0 ? item.bg : palette.bgs[i % palette.bgs.length],
    }));
  return {
    ...settings,
    lines: settings.lines.map((line) => ({
      ...line,
      left: paint(line.left),
      right: paint(line.right),
    })),
  };
}

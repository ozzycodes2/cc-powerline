/**
 * The Settings algebra: every edit the app can make to a config, as a pure
 * `Settings -> Settings` transform. Out-of-range targets are no-ops, so a caller
 * can dispatch freely without pre-checking bounds. This is the one home for
 * "how to change a config" — the TUI reducer drives it for interactive edits,
 * the wizard builds through {@link applyPalette}, and a future `config set`
 * command would reuse the same operations rather than re-deriving them.
 */
import type { Color } from '../render/types.js';
import type { LineConfig, Settings, WidgetItem } from '../types/Settings.js';
import { applyPalette } from './palette.js';

export type Side = 'left' | 'right';

export { applyPalette };

/** An empty line placeholder used when adding a fresh line. */
export const EMPTY_LINE: LineConfig = { left: [], right: [] };

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Replace one line immutably; out-of-range indices are a no-op. */
export function withLine(
  settings: Settings,
  lineIndex: number,
  update: (line: LineConfig) => LineConfig,
): Settings {
  const line = settings.lines[lineIndex];
  if (!line) {
    return settings;
  }
  const lines = settings.lines.slice();
  lines[lineIndex] = update(line);
  return { ...settings, lines };
}

/** Replace one widget item immutably; out-of-range indices are a no-op. */
export function withItem(
  settings: Settings,
  lineIndex: number,
  side: Side,
  itemIndex: number,
  update: (item: WidgetItem) => WidgetItem,
): Settings {
  return withLine(settings, lineIndex, (line) => {
    const group = line[side];
    if (!group[itemIndex]) {
      return line;
    }
    const next = group.slice();
    next[itemIndex] = update(next[itemIndex]!);
    return { ...line, [side]: next };
  });
}

export function addWidget(
  settings: Settings,
  lineIndex: number,
  side: Side,
  widgetType: string,
  at?: number,
): Settings {
  return withLine(settings, lineIndex, (line) => {
    const group = line[side].slice();
    const index = at ?? group.length;
    group.splice(clamp(index, 0, group.length), 0, { type: widgetType });
    return { ...line, [side]: group };
  });
}

export function removeWidget(
  settings: Settings,
  lineIndex: number,
  side: Side,
  itemIndex: number,
): Settings {
  return withLine(settings, lineIndex, (line) => {
    const group = line[side].slice();
    if (!group[itemIndex]) {
      return line;
    }
    group.splice(itemIndex, 1);
    return { ...line, [side]: group };
  });
}

/** Swap a widget with its neighbour in `dir`; a move off either end is a no-op. */
export function moveWidget(
  settings: Settings,
  lineIndex: number,
  side: Side,
  itemIndex: number,
  dir: -1 | 1,
): Settings {
  return withLine(settings, lineIndex, (line) => {
    const group = line[side].slice();
    const to = itemIndex + dir;
    if (!group[itemIndex] || to < 0 || to >= group.length) {
      return line;
    }
    [group[itemIndex], group[to]] = [group[to]!, group[itemIndex]!];
    return { ...line, [side]: group };
  });
}

/** Move a widget to the end of the opposite group on the same line. */
export function moveWidgetAcross(
  settings: Settings,
  lineIndex: number,
  side: Side,
  itemIndex: number,
): Settings {
  const other: Side = side === 'left' ? 'right' : 'left';
  return withLine(settings, lineIndex, (line) => {
    const from = line[side].slice();
    const item = from[itemIndex];
    if (!item) {
      return line;
    }
    from.splice(itemIndex, 1);
    return { ...line, [side]: from, [other]: [...line[other], item] };
  });
}

export function setWidgetColor(
  settings: Settings,
  lineIndex: number,
  side: Side,
  itemIndex: number,
  channel: 'fg' | 'bg',
  color: Color | undefined,
): Settings {
  return withItem(settings, lineIndex, side, itemIndex, (item) => {
    const next = { ...item };
    if (color === undefined) {
      delete next[channel];
    } else {
      next[channel] = color;
    }
    return next;
  });
}

export function setWidgetOption(
  settings: Settings,
  lineIndex: number,
  side: Side,
  itemIndex: number,
  key: string,
  value: unknown,
): Settings {
  return withItem(settings, lineIndex, side, itemIndex, (item) => ({
    ...item,
    options: { ...(item.options ?? {}), [key]: value },
  }));
}

/** Append a fresh empty line. */
export function addLine(settings: Settings): Settings {
  return { ...settings, lines: [...settings.lines, { ...EMPTY_LINE }] };
}

/** Remove a line, but never the last one — a config always keeps ≥1 line. */
export function removeLine(settings: Settings, lineIndex: number): Settings {
  if (settings.lines.length <= 1 || !settings.lines[lineIndex]) {
    return settings;
  }
  const lines = settings.lines.slice();
  lines.splice(lineIndex, 1);
  return { ...settings, lines };
}

/** Swap a line with its neighbour in `dir`; a move off either end is a no-op. */
export function moveLine(settings: Settings, lineIndex: number, dir: -1 | 1): Settings {
  const to = lineIndex + dir;
  if (!settings.lines[lineIndex] || to < 0 || to >= settings.lines.length) {
    return settings;
  }
  const lines = settings.lines.slice();
  [lines[lineIndex], lines[to]] = [lines[to]!, lines[lineIndex]!];
  return { ...settings, lines };
}

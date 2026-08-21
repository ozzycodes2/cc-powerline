/**
 * Resolve a parsed {@link Settings} into fully-concrete render instructions.
 * This is the config layer's single responsibility: apply the fg/bg cascade
 * (item -> line defaults -> theme -> builtin) and parse each widget's options,
 * so the render layer only draws and never resolves defaults.
 */
import { DEFAULT_THEME, type PowerlineTheme } from '../render/powerlineRenderer.js';
import type { Color } from '../render/types.js';
import type { LineConfig, Settings, WidgetItem } from '../types/Settings.js';
import { parseWidgetOptions } from '../widgets/registry.js';

export interface ResolvedItem {
  type: string;
  fg: Color;
  bg: Color;
  options: unknown;
}

export interface ResolvedLine {
  left: ResolvedItem[];
  right: ResolvedItem[];
}

export interface ResolvedSettings {
  style: 'powerline' | 'builtin';
  separator?: string;
  theme: PowerlineTheme;
  lines: ResolvedLine[];
}

function resolveTheme(settings: Settings): PowerlineTheme {
  return {
    separator: settings.theme?.separator ?? DEFAULT_THEME.separator,
    rightSeparator: settings.theme?.rightSeparator ?? DEFAULT_THEME.rightSeparator,
    defaultFg: (settings.theme?.defaultFg as Color) ?? DEFAULT_THEME.defaultFg,
    defaultBg: (settings.theme?.defaultBg as Color) ?? DEFAULT_THEME.defaultBg,
  };
}

function resolveItem(
  item: WidgetItem,
  lineDefaults: LineConfig['defaults'],
  theme: PowerlineTheme,
): ResolvedItem {
  return {
    type: item.type,
    fg: (item.fg as Color) ?? (lineDefaults?.fg as Color) ?? theme.defaultFg,
    bg: (item.bg as Color) ?? (lineDefaults?.bg as Color) ?? theme.defaultBg,
    options: parseWidgetOptions(item.type, item.options),
  };
}

export function resolveSettings(settings: Settings): ResolvedSettings {
  const theme = resolveTheme(settings);
  return {
    style: settings.style,
    separator: settings.separator,
    theme,
    lines: settings.lines.map((line) => ({
      left: line.left.map((i) => resolveItem(i, line.defaults, theme)),
      right: line.right.map((i) => resolveItem(i, line.defaults, theme)),
    })),
  };
}

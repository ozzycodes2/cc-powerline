/**
 * Turn resolved settings + a widget context into the final status string.
 * Pure and width-parameterized, so it can be snapshot-tested without touching
 * stdin, the filesystem, or the terminal.
 */
import { renderBuiltin } from './render/builtinRenderer.js';
import { DEFAULT_THEME, renderPowerline, type PowerlineTheme } from './render/powerlineRenderer.js';
import type { Color, LineGroups, Segment } from './render/types.js';
import type { Settings, WidgetItem } from './types/Settings.js';
import { renderWidget } from './widgets/registry.js';
import type { WidgetContext } from './widgets/Widget.js';

function toSegment(item: WidgetItem, ctx: WidgetContext): Segment {
  const text = renderWidget(item.type, ctx, item.options);
  return {
    text: text ?? '',
    fg: item.fg as Color | undefined,
    bg: item.bg as Color | undefined,
    hidden: text === null,
  };
}

function toGroups(line: { left: WidgetItem[]; right: WidgetItem[] }, ctx: WidgetContext): LineGroups {
  return {
    left: line.left.map((item) => toSegment(item, ctx)),
    right: line.right.map((item) => toSegment(item, ctx)),
  };
}

function resolveTheme(settings: Settings): PowerlineTheme {
  return {
    separator: settings.theme?.separator ?? DEFAULT_THEME.separator,
    rightSeparator: settings.theme?.rightSeparator ?? DEFAULT_THEME.rightSeparator,
    defaultFg: (settings.theme?.defaultFg as Color) ?? DEFAULT_THEME.defaultFg,
    defaultBg: (settings.theme?.defaultBg as Color) ?? DEFAULT_THEME.defaultBg,
  };
}

/** Build the full (possibly multi-line) status string. */
export function buildStatus(settings: Settings, ctx: WidgetContext, width: number): string {
  const theme = resolveTheme(settings);
  return settings.lines
    .map((line) => {
      const groups = toGroups(line, ctx);
      return settings.style === 'powerline'
        ? renderPowerline(groups, width, theme)
        : renderBuiltin(groups, { separator: settings.separator });
    })
    .join('\n');
}

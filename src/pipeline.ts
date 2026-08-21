/**
 * Turn resolved settings + a widget context into the final status string.
 * Pure and width-parameterized, so it can be snapshot-tested without touching
 * stdin, the filesystem, or the terminal.
 */
import { renderBuiltin } from './render/builtinRenderer.js';
import { renderPowerline } from './render/powerlineRenderer.js';
import type { LineGroups, Segment } from './render/types.js';
import type { Settings } from './types/Settings.js';
import { resolveSettings, type ResolvedItem, type ResolvedLine, type ResolvedSettings } from './config/resolveSettings.js';
import { renderWidget } from './widgets/registry.js';
import type { WidgetContext } from './widgets/Widget.js';

/**
 * Builtin mode has no background blocks and only colorizes text when a
 * segment's fg is explicitly set (see builtinRenderer's `s.fg ? colorize`).
 * The resolver's cascade always bottoms out at the theme/builtin default so
 * powerline always has a concrete box color, but that same fallback would
 * make builtin colorize every segment that used to render as plain text.
 * Drop fg/bg here when they only came from that final fallback tier.
 */
function toSegment(item: ResolvedItem, ctx: WidgetContext, theme: ResolvedSettings['theme'], style: ResolvedSettings['style']): Segment {
  const text = renderWidget(item.type, ctx, item.options);
  const fg = style === 'builtin' && item.fg === theme.defaultFg ? undefined : item.fg;
  const bg = style === 'builtin' && item.bg === theme.defaultBg ? undefined : item.bg;
  return { text: text ?? '', fg, bg, hidden: text === null };
}

function toGroups(line: ResolvedLine, ctx: WidgetContext, theme: ResolvedSettings['theme'], style: ResolvedSettings['style']): LineGroups {
  return {
    left: line.left.map((item) => toSegment(item, ctx, theme, style)),
    right: line.right.map((item) => toSegment(item, ctx, theme, style)),
  };
}

/** Build the full (possibly multi-line) status string. */
export function buildStatus(settings: Settings, ctx: WidgetContext, width: number): string {
  const resolved = resolveSettings(settings);
  return resolved.lines
    .map((line) => {
      const groups = toGroups(line, ctx, resolved.theme, resolved.style);
      return resolved.style === 'powerline'
        ? renderPowerline(groups, width, resolved.theme)
        : renderBuiltin(groups, { separator: resolved.separator });
    })
    .join('\n');
}

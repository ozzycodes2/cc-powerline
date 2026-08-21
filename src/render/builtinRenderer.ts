/**
 * Built-in renderer: Claude Code's plain, left-aligned single-line look. No
 * left/right split and no powerline arrows — visible segments are joined by a
 * separator, foreground-colored only (no background blocks).
 *
 * Per the config contract, built-in mode ignores the `right` group entirely at
 * render time; `loadSettings` emits a one-time load warning if the user
 * configured right-side widgets under this style.
 */
import { colorize } from './colors.js';
import type { LineGroups, Segment } from './types.js';

export const DEFAULT_BUILTIN_SEPARATOR = '  ';

export interface BuiltinOptions {
  separator?: string;
}

function visibleSegments(segments: Segment[]): Segment[] {
  return segments.filter((s) => !s.hidden && s.text.length > 0);
}

export function renderBuiltin(groups: LineGroups, opts: BuiltinOptions = {}): string {
  const separator = opts.separator ?? DEFAULT_BUILTIN_SEPARATOR;
  return visibleSegments(groups.left)
    .map((s) => (s.fg ? colorize(s.text, { fg: s.fg }) : s.text))
    .join(separator);
}

/**
 * A small color chip. It paints the block with the exact same `colorize` the
 * renderer uses (raw SGR passed through Ink's `<Text>`), so what the picker
 * shows is byte-for-byte what the status line will emit — named colors and
 * 24-bit hex alike. `undefined` means "inherit", drawn as a dim hollow box.
 */
import { Text } from 'ink';
import { colorize } from '../../render/colors.js';
import type { Color } from '../../render/types.js';

export interface SwatchProps {
  color: Color | undefined;
  /** Number of cells wide; defaults to a 2-cell chip. */
  cells?: number;
}

export function Swatch({ color, cells = 2 }: SwatchProps) {
  if (color === undefined) {
    return <Text dimColor>{'▢'.repeat(cells)}</Text>;
  }
  return <Text>{colorize(' '.repeat(cells), { bg: color })}</Text>;
}

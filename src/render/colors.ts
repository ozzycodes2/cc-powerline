/**
 * ANSI SGR color helpers. Supports the basic 16 named colors and 24-bit
 * truecolor via `#rrggbb`. Foreground and background share the same color
 * space; only the SGR base differs (38 vs 48).
 */
import type { Color } from './types.js';

export const RESET = '\x1b[0m';

const NAMED_FG: Record<string, number> = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
  brightRed: 91,
  brightGreen: 92,
  brightYellow: 93,
  brightBlue: 94,
  brightMagenta: 95,
  brightCyan: 96,
  brightWhite: 97,
};

/** The basic named colors, in SGR order — the palette the color picker offers. */
export const NAMED_COLORS = Object.keys(NAMED_FG) as Color[];

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) {
    return null;
  }
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** SGR parameters for a foreground color, or null if unrecognized. */
export function fgParams(color: Color): string | null {
  const rgb = hexToRgb(color);
  if (rgb) {
    return `38;2;${rgb[0]};${rgb[1]};${rgb[2]}`;
  }
  const code = NAMED_FG[color];
  return code === undefined ? null : String(code);
}

/** SGR parameters for a background color, or null if unrecognized. */
export function bgParams(color: Color): string | null {
  const rgb = hexToRgb(color);
  if (rgb) {
    return `48;2;${rgb[0]};${rgb[1]};${rgb[2]}`;
  }
  const code = NAMED_FG[color];
  // Background codes are the foreground code + 10.
  return code === undefined ? null : String(code + 10);
}

/** Wrap `text` in the given fg/bg colors, resetting afterward. */
export function colorize(
  text: string,
  opts: { fg?: Color; bg?: Color },
): string {
  const parts: string[] = [];
  if (opts.fg) {
    const p = fgParams(opts.fg);
    if (p) {
      parts.push(p);
    }
  }
  if (opts.bg) {
    const p = bgParams(opts.bg);
    if (p) {
      parts.push(p);
    }
  }
  if (parts.length === 0) {
    return text;
  }
  return `\x1b[${parts.join(';')}m${text}${RESET}`;
}

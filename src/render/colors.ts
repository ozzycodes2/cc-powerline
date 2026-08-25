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

// Approximate sRGB for each named color, so luminance can be judged uniformly
// with hex colors. Values follow the common xterm default palette.
const NAMED_RGB: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  red: [128, 0, 0],
  green: [0, 128, 0],
  yellow: [128, 128, 0],
  blue: [0, 0, 128],
  magenta: [128, 0, 128],
  cyan: [0, 128, 128],
  white: [192, 192, 192],
  gray: [128, 128, 128],
  brightRed: [255, 0, 0],
  brightGreen: [0, 255, 0],
  brightYellow: [255, 255, 0],
  brightBlue: [0, 0, 255],
  brightMagenta: [255, 0, 255],
  brightCyan: [0, 255, 255],
  brightWhite: [255, 255, 255],
};

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

/**
 * Choose a foreground that stays legible on `bg`: dark text on a light
 * background, light text on a dark one. Uses perceived (YIQ) luminance so
 * imported theme rings with light segments (white, bright yellow) don't end up
 * with unreadable white-on-white text. Unrecognized colors default to light
 * text, matching the powerline default.
 */
export function readableFg(bg: Color): Color {
  const rgb = hexToRgb(bg) ?? NAMED_RGB[bg];
  if (!rgb) {
    return 'brightWhite';
  }
  const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  return luminance > 128 ? 'black' : 'brightWhite';
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

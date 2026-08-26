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

// sRGB for each named color, matching what terminals actually paint (the common
// xterm default palette), so contrast is judged against the real background.
// Using the dim SGR half-values here underestimates the brightness of normal
// yellow/green/cyan and leaves them with unreadable white text.
const NAMED_RGB: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  red: [205, 0, 0],
  green: [0, 205, 0],
  yellow: [205, 205, 0],
  blue: [0, 0, 238],
  magenta: [205, 0, 205],
  cyan: [0, 205, 205],
  white: [229, 229, 229],
  gray: [127, 127, 127],
  brightRed: [255, 0, 0],
  brightGreen: [0, 255, 0],
  brightYellow: [255, 255, 0],
  brightBlue: [92, 92, 255],
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

/** One channel's contribution to WCAG relative luminance (sRGB → linear). */
function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an sRGB color, in [0, 1]. */
function relativeLuminance(rgb: [number, number, number]): number {
  return (
    0.2126 * channelLuminance(rgb[0]) +
    0.7152 * channelLuminance(rgb[1]) +
    0.0722 * channelLuminance(rgb[2])
  );
}

/**
 * Invert {@link channelLuminance}: the 8-bit channel value whose linear
 * contribution is `l`. For a neutral gray (R=G=B) the per-channel weights sum to
 * 1, so a color's relative luminance equals this single channel's contribution —
 * which is why a target luminance maps straight to one gray value.
 */
function luminanceToChannel(l: number): number {
  const s = l <= 0.03928 / 12.92 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
}

// Above this WCAG relative luminance, dark text out-contrasts light text on the
// background, so the readable foreground darkens rather than lightens. It is the
// black/white contrast-ratio crossover √(0.05·1.05) − 0.05.
const DARKEN_THRESHOLD = 0.179;

// Target WCAG contrast ratio (AAA for normal text). The foreground is softened
// to land near this rather than maxed at pure black/white, which reads as harsh
// on a colored segment; mid-tones that can't reach it clamp to the extreme.
const TARGET_CONTRAST = 7;

/**
 * Choose a foreground that keeps `bg` legible at a deterministic contrast
 * distance. Rather than snapping to pure black or bright white, it solves for the
 * neutral gray whose WCAG contrast ratio against the background lands at
 * {@link TARGET_CONTRAST}, darkening on light backgrounds and lightening on dark
 * ones. Mid-tone backgrounds where 7:1 is physically unreachable clamp to the
 * extreme (maximum contrast). Returns a `#rrggbb` string; unrecognized
 * backgrounds are treated as dark and take light text.
 *
 * Named backgrounds are resolved through the xterm-default palette, so the ratio
 * is exact only for `#rrggbb` backgrounds; a terminal's own palette may differ.
 */
export function readableFg(bg: Color): Color {
  const rgb = hexToRgb(bg) ?? NAMED_RGB[bg];
  const bgLum = rgb ? relativeLuminance(rgb) : 0;
  // Contrast ratio is (Llight + 0.05) / (Ldark + 0.05); solve for the foreground
  // luminance that hits the target, in whichever direction has headroom. Clamp
  // handles the unreachable mid-tones by bottoming/topping out at black/white.
  const targetLum =
    bgLum > DARKEN_THRESHOLD
      ? (bgLum + 0.05) / TARGET_CONTRAST - 0.05
      : TARGET_CONTRAST * (bgLum + 0.05) - 0.05;
  const v = luminanceToChannel(targetLum);
  const hex = v.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
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

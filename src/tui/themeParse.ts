/**
 * Pure parsers that turn a shell/prompt theme's raw text into a background color
 * ring — the same shape a built-in preset uses. The Theme panel offers these
 * rings so a user's existing prompt palette (Powerlevel10k, oh-my-posh, classic
 * Powerline) recolors the status line in one keystroke. All IO (finding and
 * reading the files) lives in `themeScan.ts`; everything here is string in,
 * `Color[]` out and unit-testable without a filesystem.
 */
import type { Color } from '../render/types.js';
import { NAMED_COLORS } from '../render/colors.js';

// The six intensity levels of the xterm 6×6×6 color cube (indices 16–231).
const CUBE_LEVELS = [0, 95, 135, 175, 215, 255];

function hex2(n: number): string {
  return n.toString(16).padStart(2, '0');
}

/**
 * Convert an xterm 256-palette index to a Color. 0–15 map to our named colors
 * (same SGR order), 16–231 to the RGB cube, 232–255 to the grayscale ramp.
 * Returns null for out-of-range input.
 */
export function xterm256ToColor(n: number): Color | null {
  if (!Number.isInteger(n) || n < 0 || n > 255) return null;
  if (n < 16) return NAMED_COLORS[n]!;
  if (n < 232) {
    const c = n - 16;
    const r = CUBE_LEVELS[Math.floor(c / 36)]!;
    const g = CUBE_LEVELS[Math.floor((c % 36) / 6)]!;
    const b = CUBE_LEVELS[c % 6]!;
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }
  const v = 8 + (n - 232) * 10;
  return `#${hex2(v)}${hex2(v)}${hex2(v)}`;
}

const HEX6 = /^#?[0-9a-fA-F]{6}$/;

/**
 * Coerce one theme color token into a Color, or null if unusable. Accepts a
 * `#rrggbb` / `rrggbb` hex string, a decimal 0–255 palette index, or one of our
 * named colors. Surrounding quotes are tolerated (p10k values are shell tokens).
 */
export function toColor(raw: string): Color | null {
  const t = raw.trim().replace(/^['"]|['"]$/g, '');
  if (t === '') return null;
  if (HEX6.test(t)) return `#${t.replace(/^#/, '').toLowerCase()}`;
  if (/^\d{1,3}$/.test(t)) return xterm256ToColor(Number(t));
  if ((NAMED_COLORS as string[]).includes(t)) return t as Color;
  return null;
}

/** First-wins dedupe that preserves discovery order. */
function ring(colors: (Color | null)[]): Color[] {
  const seen = new Set<string>();
  const out: Color[] = [];
  for (const c of colors) {
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

// p10k config lines look like `typeset -g POWERLEVEL9K_DIR_BACKGROUND=4`. We only
// want the background of each segment; foreground/gap colors would muddy the ring.
const P10K_BG = /POWERLEVEL9K_[A-Z0-9_]*?BACKGROUND=(['"]?)([#\w]+)\1/g;

/** Extract the background palette from a `~/.p10k.zsh` config, in file order. */
export function parseP10k(text: string): Color[] {
  const colors: (Color | null)[] = [];
  for (const m of text.matchAll(P10K_BG)) {
    colors.push(toColor(m[2]!));
  }
  return ring(colors);
}

/**
 * Extract a palette from a classic Powerline colorscheme (or `colors.json`).
 * Its `colors` map is `name -> cterm | [cterm, "rrggbb"]`; group refs (plain
 * string values) are skipped. Object key order is the discovery order.
 */
export function parsePowerline(json: unknown): Color[] {
  const colors = (json as { colors?: Record<string, unknown> })?.colors;
  if (!colors || typeof colors !== 'object') return [];
  const out: (Color | null)[] = [];
  for (const v of Object.values(colors)) {
    if (typeof v === 'number') out.push(xterm256ToColor(v));
    else if (Array.isArray(v) && typeof v[1] === 'string') out.push(toColor(v[1]));
    else if (Array.isArray(v) && typeof v[0] === 'number') out.push(xterm256ToColor(v[0]));
  }
  return ring(out);
}

interface OmpSegment {
  background?: string;
}
interface OmpTheme {
  palette?: Record<string, string>;
  blocks?: { segments?: OmpSegment[] }[];
}

/**
 * Extract segment backgrounds from an oh-my-posh theme, in block/segment order.
 * A `p:name` value is a reference into the theme's `palette`; resolve it before
 * coercing. Bare `background` templates that aren't colors just drop out as null.
 */
export function parseOhMyPosh(json: unknown): Color[] {
  const theme = json as OmpTheme;
  const palette = theme?.palette ?? {};
  const out: (Color | null)[] = [];
  for (const block of theme?.blocks ?? []) {
    for (const seg of block?.segments ?? []) {
      let bg = seg?.background;
      if (typeof bg !== 'string') continue;
      if (bg.startsWith('p:')) bg = palette[bg.slice(2)] ?? '';
      out.push(toColor(bg));
    }
  }
  return ring(out);
}

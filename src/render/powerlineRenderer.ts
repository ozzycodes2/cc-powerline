/**
 * Powerline renderer: colored segment blocks joined by arrow separators, with
 * true left/right anchoring. The left group chains left-to-right with the
 * `` glyph; the right group mirrors it with `` so the arrows point back
 * toward the edge. The color-chain rule is identical either side — an arrow is
 * drawn in one block's background as its foreground against the neighbor's
 * background — only the direction of "neighbor" flips.
 */
import { composeLine } from './composeLine.js';
import { fgParams, bgParams, RESET } from './colors.js';
import type { Color, LineGroups, RenderedGroup, Segment } from './types.js';

/** Classic powerline glyphs (Nerd Font / Powerline symbols). */
export const SEP_LEFT = ''; //
export const SEP_RIGHT = ''; //

export interface PowerlineTheme {
  /** Left-group joiner/cap glyph. */
  separator: string;
  /** Right-group joiner/cap glyph (mirrored). */
  rightSeparator: string;
  /** Foreground used when a segment omits `fg`. */
  defaultFg: Color;
  /** Background used when a segment omits `bg`. */
  defaultBg: Color;
}

export const DEFAULT_THEME: PowerlineTheme = {
  separator: SEP_LEFT,
  rightSeparator: SEP_RIGHT,
  defaultFg: 'brightWhite',
  defaultBg: 'gray',
};

function open(opts: { fg?: Color; bg?: Color }): string {
  const parts: string[] = [];
  if (opts.fg) {
    const p = fgParams(opts.fg);
    if (p) parts.push(p);
  }
  if (opts.bg) {
    const p = bgParams(opts.bg);
    if (p) parts.push(p);
  }
  return parts.length ? `\x1b[${parts.join(';')}m` : '';
}

function visible(segments: Segment[]): Segment[] {
  return segments.filter((s) => !s.hidden && s.text.length > 0);
}

/** Render the left group: `[ seg ][ seg ]…` chained with `` and an end cap. */
export function renderLeftGroup(segments: Segment[], theme: PowerlineTheme): RenderedGroup {
  const segs = visible(segments);
  if (segs.length === 0) {
    return { text: '', width: 0 };
  }
  let text = '';
  let width = 0;
  for (let i = 0; i < segs.length; i += 1) {
    const s = segs[i]!;
    const fg = s.fg ?? theme.defaultFg;
    const bg = s.bg ?? theme.defaultBg;
    text += `${open({ fg, bg })} ${s.text} `;
    width += s.text.length + 2;

    const next = segs[i + 1];
    if (next) {
      const nextBg = next.bg ?? theme.defaultBg;
      text += `${open({ fg: bg, bg: nextBg })}${theme.separator}`;
    } else {
      // End cap: this block's color as an arrow on the default background.
      text += `${RESET}${open({ fg: bg })}${theme.separator}${RESET}`;
    }
    width += 1;
  }
  return { text, width };
}

/** Render the right group: a leading `` cap, then mirrored chaining. */
export function renderRightGroup(segments: Segment[], theme: PowerlineTheme): RenderedGroup {
  const segs = visible(segments);
  if (segs.length === 0) {
    return { text: '', width: 0 };
  }
  const first = segs[0]!;
  const firstBg = first.bg ?? theme.defaultBg;
  // Leading cap: first block's color as a left-pointing arrow on default bg.
  let text = `${RESET}${open({ fg: firstBg })}${theme.rightSeparator}`;
  let width = 1;
  for (let i = 0; i < segs.length; i += 1) {
    const s = segs[i]!;
    const fg = s.fg ?? theme.defaultFg;
    const bg = s.bg ?? theme.defaultBg;
    text += `${open({ fg, bg })} ${s.text} `;
    width += s.text.length + 2;

    const next = segs[i + 1];
    if (next) {
      const nextBg = next.bg ?? theme.defaultBg;
      // Mirrored: the neighbor to the RIGHT juts left into this block.
      text += `${open({ fg: nextBg, bg })}${theme.rightSeparator}`;
      width += 1;
    }
  }
  text += RESET;
  return { text, width };
}

/** Render a full powerline status line at a fixed width. */
export function renderPowerline(
  groups: LineGroups,
  width: number,
  theme: PowerlineTheme = DEFAULT_THEME,
): string {
  const left = renderLeftGroup(groups.left, theme);
  const right = renderRightGroup(groups.right, theme);
  return composeLine({ left, right, width });
}

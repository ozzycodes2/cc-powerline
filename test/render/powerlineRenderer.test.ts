import { describe, it, expect } from 'vitest';
import {
  renderLeftGroup,
  renderRightGroup,
  renderPowerline,
  SEP_LEFT,
  SEP_RIGHT,
  DEFAULT_THEME,
} from '../../src/render/powerlineRenderer.js';
import { stripAnsi, visibleWidth } from '../../src/render/stripAnsi.js';
import type { Segment } from '../../src/render/types.js';

const A: Segment = { text: 'AA', fg: '#000000', bg: '#112233' };
const B: Segment = { text: 'BBB', fg: '#ffffff', bg: '#445566' };

describe('renderLeftGroup', () => {
  it('reports a width that matches the visible width', () => {
    const g = renderLeftGroup([A, B], DEFAULT_THEME);
    expect(g.width).toBe(visibleWidth(g.text));
  });

  it('lays out padded blocks separated and capped by ', () => {
    const g = renderLeftGroup([A, B], DEFAULT_THEME);
    // " AA " + arrow + " BBB " + endcap arrow
    expect(stripAnsi(g.text)).toBe(` AA ${SEP_LEFT} BBB ${SEP_LEFT}`);
  });

  it("chains an inter-segment arrow in the left block's bg over the right block's bg", () => {
    const g = renderLeftGroup([A, B], DEFAULT_THEME);
    // arrow between A and B: fg = A.bg (#112233), bg = B.bg (#445566)
    expect(g.text).toContain(`\x1b[38;2;17;34;51;48;2;68;85;102m${SEP_LEFT}`);
  });

  it('is empty for no visible segments', () => {
    expect(renderLeftGroup([], DEFAULT_THEME)).toEqual({ text: '', width: 0 });
    expect(
      renderLeftGroup([{ text: '', hidden: true }], DEFAULT_THEME),
    ).toEqual({
      text: '',
      width: 0,
    });
  });
});

describe('renderRightGroup', () => {
  it('reports a width that matches the visible width', () => {
    const g = renderRightGroup([A, B], DEFAULT_THEME);
    expect(g.width).toBe(visibleWidth(g.text));
  });

  it('starts with a leading  cap then padded blocks', () => {
    const g = renderRightGroup([A, B], DEFAULT_THEME);
    expect(stripAnsi(g.text)).toBe(`${SEP_RIGHT} AA ${SEP_RIGHT} BBB `);
  });

  it("mirrors the chain: the right neighbor's bg juts left into the current block", () => {
    const g = renderRightGroup([A, B], DEFAULT_THEME);
    // inter arrow: fg = B.bg (#445566), bg = A.bg (#112233)
    expect(g.text).toContain(`\x1b[38;2;68;85;102;48;2;17;34;51m${SEP_RIGHT}`);
  });
});

describe('renderPowerline', () => {
  it('anchors right group to the far edge at the given width', () => {
    const line = renderPowerline({ left: [A], right: [B] }, 40, DEFAULT_THEME);
    expect(visibleWidth(line)).toBe(40);
  });

  it('falls back to default fg/bg for segments without colors', () => {
    const line = renderPowerline({ left: [{ text: 'plain' }], right: [] }, 40);
    expect(stripAnsi(line)).toContain('plain');
    // default bg is gray (SGR 100 as background)
    expect(line).toContain('100');
  });
});

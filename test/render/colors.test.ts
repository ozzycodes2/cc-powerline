import { describe, it, expect } from 'vitest';
import {
  fgParams,
  bgParams,
  colorize,
  readableFg,
  RESET,
} from '../../src/render/colors.js';

describe('fgParams / bgParams', () => {
  it('maps named colors to SGR codes', () => {
    expect(fgParams('red')).toBe('31');
    expect(bgParams('red')).toBe('41'); // fg + 10
    expect(fgParams('brightBlue')).toBe('94');
  });

  it('maps #rrggbb to 24-bit truecolor', () => {
    expect(fgParams('#112233')).toBe('38;2;17;34;51');
    expect(bgParams('#112233')).toBe('48;2;17;34;51');
  });

  it('returns null for an unrecognized color', () => {
    expect(fgParams('#xyz' as `#${string}`)).toBeNull();
    expect(fgParams('mauve' as never)).toBeNull();
  });
});

describe('readableFg', () => {
  // sRGB per channel -> WCAG relative luminance, and the ratio between two.
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = ([r, g, b]: [number, number, number]) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const parse = (hex: string): [number, number, number] => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  };
  const contrast = (fg: string, bgRgb: [number, number, number]) => {
    const a = lum(parse(fg)) + 0.05;
    const b = lum(bgRgb) + 0.05;
    return a > b ? a / b : b / a;
  };
  // The xterm-default RGB readableFg resolves each named color to.
  const NAMED: Record<string, [number, number, number]> = {
    white: [229, 229, 229],
    blue: [0, 0, 238],
    black: [0, 0, 0],
    green: [0, 205, 0],
    yellow: [205, 205, 0],
  };

  it('returns a neutral gray hex, not a named color', () => {
    const fg = readableFg('blue');
    expect(fg).toMatch(/^#([0-9a-f]{2})\1\1$/);
  });

  it('lands near the 7:1 AAA target when it is reachable', () => {
    // Both a light and a dark background have room to hit 7:1 exactly.
    expect(contrast(readableFg('#3d5a80'), parse('#3d5a80'))).toBeCloseTo(7, 0);
    expect(contrast(readableFg('#e5e5e5'), parse('#e5e5e5'))).toBeCloseTo(7, 0);
  });

  it('lightens on dark backgrounds and darkens on light ones', () => {
    // A dark bg gets light text (luminance above the bg); a light bg the reverse.
    expect(lum(parse(readableFg('blue')))).toBeGreaterThan(lum(NAMED.blue!));
    expect(lum(parse(readableFg('white')))).toBeLessThan(lum(NAMED.white!));
  });

  it('never drops below AA (4.5:1), even on unreachable mid-tones', () => {
    for (const [name, rgb] of Object.entries(NAMED)) {
      expect(contrast(readableFg(name as never), rgb)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('clamps to pure white/black on mid-tones where 7:1 overshoots', () => {
    // A medium-dark red can't reach 7:1 even with white, so it maxes out light;
    // a medium gray can't reach it with black, so it maxes out dark. (Pure black
    // and white are *easy* — a mid-gray already clears 7:1 — so they don't clamp.)
    expect(readableFg('red')).toBe('#ffffff');
    expect(readableFg('#808080')).toBe('#000000');
  });

  it('treats an unrecognized background as dark and takes light text', () => {
    // rgb is unknown -> luminance 0 -> a light gray at the 7:1 target, not #fff.
    const fg = readableFg('mauve' as never);
    expect(fg).toMatch(/^#([0-9a-f]{2})\1\1$/);
    expect(contrast(fg, [0, 0, 0])).toBeCloseTo(7, 0);
  });
});

describe('colorize', () => {
  it('wraps text in fg+bg and resets', () => {
    expect(colorize('x', { fg: 'red', bg: 'blue' })).toBe(
      `\x1b[31;44mx${RESET}`,
    );
  });

  it('returns bare text when no color resolves', () => {
    expect(colorize('x', {})).toBe('x');
  });
});

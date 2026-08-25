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
  it('picks dark text on a light background', () => {
    expect(readableFg('white')).toBe('black');
    expect(readableFg('brightWhite')).toBe('black');
    expect(readableFg('brightYellow')).toBe('black');
    expect(readableFg('#ffffff')).toBe('black');
  });

  it('picks light text on a dark background', () => {
    expect(readableFg('blue')).toBe('brightWhite');
    expect(readableFg('black')).toBe('brightWhite');
    expect(readableFg('#000080')).toBe('brightWhite');
  });

  it('falls back to light text when the background is unrecognized', () => {
    expect(readableFg('mauve' as never)).toBe('brightWhite');
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

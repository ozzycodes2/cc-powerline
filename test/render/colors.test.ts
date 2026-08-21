import { describe, it, expect } from 'vitest';
import { fgParams, bgParams, colorize, RESET } from '../../src/render/colors.js';

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

describe('colorize', () => {
  it('wraps text in fg+bg and resets', () => {
    expect(colorize('x', { fg: 'red', bg: 'blue' })).toBe(`\x1b[31;44mx${RESET}`);
  });

  it('returns bare text when no color resolves', () => {
    expect(colorize('x', {})).toBe('x');
  });
});

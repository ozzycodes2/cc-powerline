import { describe, it, expect } from 'vitest';
import { expandSgr } from '../../src/render/sgr.js';

const E = '\x1b';

describe('expandSgr', () => {
  it('splits a compound fg+bg escape into one escape per attribute', () => {
    // brightWhite (97) + truecolor bg.
    expect(expandSgr(`${E}[97;48;2;79;93;117m x`)).toBe(`${E}[97m${E}[48;2;79;93;117m x`);
  });

  it('splits two truecolor attributes (the separator escape)', () => {
    expect(expandSgr(`${E}[38;2;79;93;117;48;2;61;90;128m`)).toBe(
      `${E}[38;2;79;93;117m${E}[48;2;61;90;128m`,
    );
  });

  it('handles the 256-color (5;n) form', () => {
    expect(expandSgr(`${E}[38;5;12;48;5;236m`)).toBe(`${E}[38;5;12m${E}[48;5;236m`);
  });

  it('leaves a full reset and a bare reset untouched', () => {
    expect(expandSgr(`${E}[0m`)).toBe(`${E}[0m`);
    expect(expandSgr(`${E}[m`)).toBe(`${E}[m`);
  });

  it('passes plain text and non-SGR escapes through unchanged', () => {
    expect(expandSgr('no escapes here')).toBe('no escapes here');
    // Cursor-home is not an SGR (ends in H) and must not be rewritten.
    expect(expandSgr(`${E}[Hplain`)).toBe(`${E}[Hplain`);
  });

  it('preserves visible characters and total length of stripped output', () => {
    const original = `${E}[97;48;2;1;2;3m Opus ${E}[0m`;
    const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
    expect(strip(expandSgr(original))).toBe(strip(original));
  });
});

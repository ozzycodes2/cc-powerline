/**
 * Pure theme parsing: xterm-256 → Color conversion, single-token coercion, and
 * the three prompt-config extractors. Each parser returns an order-preserving,
 * first-wins-deduped background ring.
 */
import { describe, it, expect } from 'vitest';
import {
  xterm256ToColor,
  toColor,
  parseP10k,
  parsePowerline,
  parseOhMyPosh,
} from '../../src/tui/themeParse.js';

describe('xterm256ToColor', () => {
  it('maps 0–15 to our named colors in SGR order', () => {
    expect(xterm256ToColor(0)).toBe('black');
    expect(xterm256ToColor(4)).toBe('blue');
    expect(xterm256ToColor(15)).toBe('brightWhite');
  });

  it('maps the 6×6×6 cube (16–231) to hex', () => {
    expect(xterm256ToColor(16)).toBe('#000000'); // cube origin
    expect(xterm256ToColor(231)).toBe('#ffffff'); // cube max
    expect(xterm256ToColor(21)).toBe('#0000ff'); // pure blue corner
  });

  it('maps the grayscale ramp (232–255) to hex', () => {
    expect(xterm256ToColor(232)).toBe('#080808');
    expect(xterm256ToColor(255)).toBe('#eeeeee');
  });

  it('rejects out-of-range and non-integer input', () => {
    expect(xterm256ToColor(-1)).toBeNull();
    expect(xterm256ToColor(256)).toBeNull();
    expect(xterm256ToColor(1.5)).toBeNull();
  });
});

describe('toColor', () => {
  it('accepts hex with or without a leading #, lowercasing it', () => {
    expect(toColor('#AABBCC')).toBe('#aabbcc');
    expect(toColor('aabbcc')).toBe('#aabbcc');
  });

  it('accepts a decimal palette index', () => {
    expect(toColor('4')).toBe('blue');
    expect(toColor('232')).toBe('#080808');
  });

  it('accepts a named color and strips surrounding quotes', () => {
    expect(toColor('brightWhite')).toBe('brightWhite');
    expect(toColor("'5'")).toBe('magenta');
  });

  it('rejects empty and unrecognized tokens', () => {
    expect(toColor('  ')).toBeNull();
    expect(toColor('nope')).toBeNull();
    expect(toColor('999')).toBeNull();
  });
});

describe('parseP10k', () => {
  it('extracts backgrounds in order, deduped, ignoring foregrounds', () => {
    const text = [
      'typeset -g POWERLEVEL9K_DIR_BACKGROUND=4',
      'typeset -g POWERLEVEL9K_DIR_FOREGROUND=254',
      'typeset -g POWERLEVEL9K_VCS_CLEAN_BACKGROUND=2',
      'typeset -g POWERLEVEL9K_STATUS_OK_BACKGROUND=4', // dup of DIR
    ].join('\n');
    expect(parseP10k(text)).toEqual(['blue', 'green']);
  });

  it('returns an empty ring when there are no background definitions', () => {
    expect(parseP10k('# just a comment\nPROMPT="%~"')).toEqual([]);
  });
});

describe('parsePowerline', () => {
  it('reads a colors map of cterm ints and [cterm, hex] pairs', () => {
    const scheme = {
      colors: {
        gray0: 233,
        blue: [31, '0087af'],
        red: [196], // cterm-only array — falls back to the palette index
        white: 231,
        ref: 'blue', // a group reference, not a color — skipped
      },
    };
    expect(parsePowerline(scheme)).toEqual(['#121212', '#0087af', '#ff0000', '#ffffff']);
  });

  it('returns empty for input without a colors object', () => {
    expect(parsePowerline({})).toEqual([]);
    expect(parsePowerline(null)).toEqual([]);
  });
});

describe('parseOhMyPosh', () => {
  it('collects segment backgrounds and resolves palette references', () => {
    const theme = {
      palette: { sky: '#89b4fa' },
      blocks: [
        { segments: [{ background: '#1e1e2e' }, { background: 'p:sky' }] },
        { segments: [{ background: '#1e1e2e' }] }, // dup drops out
      ],
    };
    expect(parseOhMyPosh(theme)).toEqual(['#1e1e2e', '#89b4fa']);
  });

  it('skips template and missing backgrounds but keeps valid ones', () => {
    const theme = {
      blocks: [{ segments: [{ background: '{{ .Foo }}' }, {}, { background: '3' }] }],
    };
    expect(parseOhMyPosh(theme)).toEqual(['yellow']);
  });

  it('tolerates blocks without segments and unresolved palette refs', () => {
    const theme = {
      palette: { sky: '#89b4fa' },
      blocks: [
        {}, // no segments array
        { segments: [{ background: 'p:missing' }, { background: 'p:sky' }] },
      ],
    };
    // p:missing resolves to '' → dropped; p:sky resolves through the palette.
    expect(parseOhMyPosh(theme)).toEqual(['#89b4fa']);
  });

  it('returns empty for input without blocks', () => {
    expect(parseOhMyPosh({})).toEqual([]);
  });
});

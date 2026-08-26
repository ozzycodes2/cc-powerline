import { describe, it, expect } from 'vitest';
import { applyPalette } from '../../src/config/palette.js';
import { SettingsSchema } from '../../src/types/Settings.js';

const parse = (raw: unknown) => SettingsSchema.parse(raw);

// The gray level readableFg baked in, as a 0-255 channel value.
const grayLevel = (fg: unknown) => {
  expect(fg).toMatch(/^#([0-9a-f]{2})\1\1$/);
  return parseInt((fg as string).slice(1, 3), 16);
};

describe('applyPalette', () => {
  it('picks a contrasting fg per item from its background', () => {
    const r = applyPalette(
      parse({ lines: [{ left: [{ type: 'model' }, { type: 'directory' }] }] }),
      { fg: 'brightWhite', bgs: ['white', 'blue'] },
    );
    // white bg -> dark gray text; blue bg -> light gray text. Each fg is derived
    // from its own bg for contrast, not a single shared fg.
    const [onWhite, onBlue] = r.lines[0]!.left.map((i) => grayLevel(i.fg));
    expect(onWhite!).toBeLessThan(128);
    expect(onBlue!).toBeGreaterThan(128);
  });

  it('falls back to the palette fg when the ring leaves bg untouched', () => {
    const r = applyPalette(parse({ lines: [{ left: [{ type: 'model' }] }] }), {
      fg: 'red',
      bgs: [],
    });
    expect(r.lines[0]!.left[0]!.fg).toBe('red');
  });

  it('cycles the bg ring per group, restarting each group at bgs[0]', () => {
    const r = applyPalette(
      parse({
        lines: [
          {
            left: [
              { type: 'model' },
              { type: 'directory' },
              { type: 'git-branch' },
            ],
            right: [{ type: 'session-cost' }],
          },
        ],
      }),
      { fg: 'white', bgs: ['#111', '#222'] },
    );
    expect(r.lines[0]!.left.map((i) => i.bg)).toEqual(['#111', '#222', '#111']);
    // The right group starts its own ring, not continuing from the left's index.
    expect(r.lines[0]!.right.map((i) => i.bg)).toEqual(['#111']);
  });

  it('leaves the existing bg untouched when the ring is empty', () => {
    const r = applyPalette(
      parse({ lines: [{ left: [{ type: 'model', bg: 'green' }] }] }),
      { fg: 'white', bgs: [] },
    );
    expect(r.lines[0]!.left[0]!.bg).toBe('green');
  });

  it('overwrites colors an item already carried', () => {
    const r = applyPalette(
      parse({
        lines: [{ left: [{ type: 'model', fg: 'black', bg: 'yellow' }] }],
      }),
      { fg: 'white', bgs: ['cyan'] },
    );
    // The auto-contrast fg replaces the item's own, and cyan is bright enough
    // (as a terminal paints it) to take dark text rather than the palette fg.
    expect(r.lines[0]!.left[0]!.bg).toBe('cyan');
    expect(grayLevel(r.lines[0]!.left[0]!.fg)).toBeLessThan(128);
  });

  it('is a no-op on a config with no lines', () => {
    const r = applyPalette(parse({ lines: [] }), { fg: 'white', bgs: ['red'] });
    expect(r.lines).toEqual([]);
  });
});

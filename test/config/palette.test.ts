import { describe, it, expect } from 'vitest';
import { applyPalette } from '../../src/config/palette.js';
import { SettingsSchema } from '../../src/types/Settings.js';

const parse = (raw: unknown) => SettingsSchema.parse(raw);

describe('applyPalette', () => {
  it('picks a contrasting fg per item from its background', () => {
    const r = applyPalette(
      parse({ lines: [{ left: [{ type: 'model' }, { type: 'directory' }] }] }),
      { fg: 'brightWhite', bgs: ['white', 'blue'] },
    );
    // white bg -> dark text; blue bg -> light text. Not a single shared fg.
    expect(r.lines[0]!.left.map((i) => i.fg)).toEqual(['black', 'brightWhite']);
  });

  it('falls back to the palette fg when the ring leaves bg untouched', () => {
    const r = applyPalette(
      parse({ lines: [{ left: [{ type: 'model' }] }] }),
      { fg: 'red', bgs: [] },
    );
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
    // cyan is dark, so the contrasting fg is brightWhite, not the palette fg.
    expect(r.lines[0]!.left[0]).toMatchObject({ fg: 'brightWhite', bg: 'cyan' });
  });

  it('is a no-op on a config with no lines', () => {
    const r = applyPalette(parse({ lines: [] }), { fg: 'white', bgs: ['red'] });
    expect(r.lines).toEqual([]);
  });
});

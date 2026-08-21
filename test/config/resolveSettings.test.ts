import { describe, it, expect } from 'vitest';
import { resolveSettings } from '../../src/config/resolveSettings.js';
import { DEFAULT_THEME } from '../../src/render/powerlineRenderer.js';
import { SettingsSchema } from '../../src/types/Settings.js';

const parse = (raw: unknown) => SettingsSchema.parse(raw);

describe('resolveSettings cascade', () => {
  it('item colors win over line defaults, theme, and builtin', () => {
    const r = resolveSettings(
      parse({
        theme: { defaultFg: 'red', defaultBg: 'blue' },
        lines: [
          {
            defaults: { fg: 'green', bg: 'magenta' },
            left: [{ type: 'model', fg: 'white', bg: 'black' }],
          },
        ],
      }),
    );
    expect(r.lines[0]!.left[0]).toMatchObject({ fg: 'white', bg: 'black' });
  });

  it('falls through item -> line -> theme -> builtin', () => {
    const noLine = resolveSettings(
      parse({ theme: { defaultFg: 'red' }, lines: [{ left: [{ type: 'model' }] }] }),
    );
    // fg from theme, bg falls all the way to the builtin default
    expect(noLine.lines[0]!.left[0]!.fg).toBe('red');
    expect(noLine.lines[0]!.left[0]!.bg).toBe(DEFAULT_THEME.defaultBg);
  });

  it('uses line defaults when the item omits colors', () => {
    const r = resolveSettings(
      parse({ lines: [{ defaults: { fg: 'green', bg: 'magenta' }, left: [{ type: 'model' }] }] }),
    );
    expect(r.lines[0]!.left[0]).toMatchObject({ fg: 'green', bg: 'magenta' });
  });

  it('parses widget options with defaults and degrades bad ones', () => {
    const r = resolveSettings(
      parse({ lines: [{ left: [{ type: 'git-branch', options: { icon: 999 } }] }] }),
    );
    // git-branch's icon fails z.string() validation on 999 and degrades to its
    // schema default, the powerline branch glyph U+E0A0 (see registryShape.test.ts).
    expect(r.lines[0]!.left[0]!.options).toEqual({ icon: '\u{e0a0}' });
  });

  it('keeps unknown widget types (they hide at render) with empty options', () => {
    const r = resolveSettings(parse({ lines: [{ left: [{ type: 'nope' }] }] }));
    expect(r.lines[0]!.left[0]).toMatchObject({ type: 'nope', options: {} });
  });
});

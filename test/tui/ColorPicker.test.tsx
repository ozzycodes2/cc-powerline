/**
 * ColorPicker wiring: swatch navigation + apply, channel toggle, the inherit
 * (clear) entry, and hex-entry mode. Mutations run through the real reducer via
 * the harness, so we assert on the resulting widget colors, not the frame.
 */
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { createElement } from 'react';
import { ColorPicker } from '../../src/tui/ColorPicker.js';
import { Harness } from './harness.js';
import { stripAnsi } from '../../src/render/stripAnsi.js';
import { NAMED_COLORS } from '../../src/render/colors.js';
import type { TuiState } from '../../src/tui/reducer.js';
import type { Settings } from '../../src/types/Settings.js';

const KEY = {
  down: '\x1b[B',
  right: '\x1b[C',
  enter: '\r',
  esc: '\x1b',
  tab: '\t',
};
const delay = (ms = 20) => new Promise((r) => setTimeout(r, ms));

const ONE: Settings = {
  style: 'powerline',
  lines: [
    { left: [{ type: 'model', fg: 'brightWhite', bg: '#2d3142' }], right: [] },
  ],
};

const mount = (settings: Settings) => {
  let state!: TuiState;
  const app = render(
    createElement(Harness, {
      settings,
      onState: (s: TuiState) => {
        state = s;
      },
      children: (s, dispatch) =>
        createElement(ColorPicker, { state: s, dispatch }),
    }),
  );
  return {
    ...app,
    get state() {
      return state;
    },
  };
};

const item = (s: TuiState) => s.settings.lines[0]!.left[0]!;

describe('ColorPicker', () => {
  it('applies a named color to the foreground', async () => {
    const h = mount(ONE);
    await delay();
    h.stdin.write(KEY.right); // move off "inherit" onto the first named color
    await delay();
    h.stdin.write(KEY.enter);
    await delay();
    expect(item(h.state).fg).toBe(NAMED_COLORS[0]); // 'black'
  });

  it('clears the color with the inherit entry', async () => {
    const h = mount(ONE);
    await delay();
    h.stdin.write(KEY.enter); // cursor starts on "inherit" (undefined)
    await delay();
    expect(item(h.state).fg).toBeUndefined();
  });

  it('edits the background channel after tab', async () => {
    const h = mount(ONE);
    await delay();
    h.stdin.write(KEY.tab); // fg -> bg
    await delay();
    h.stdin.write(KEY.right);
    await delay();
    h.stdin.write(KEY.enter);
    await delay();
    expect(item(h.state).bg).toBe(NAMED_COLORS[0]);
    expect(item(h.state).fg).toBe('brightWhite'); // fg untouched
  });

  it('accepts a #rrggbb color in hex-entry mode', async () => {
    const h = mount(ONE);
    await delay();
    h.stdin.write('h'); // open hex entry (buffer starts "#")
    await delay();
    for (const ch of '00ff00') {
      h.stdin.write(ch);
      await delay(5);
    }
    h.stdin.write(KEY.enter);
    await delay();
    expect(item(h.state).fg).toBe('#00ff00');
  });

  it('rejects an incomplete hex value and keeps the entry open', async () => {
    const h = mount(ONE);
    await delay();
    h.stdin.write('h');
    await delay();
    h.stdin.write(KEY.enter); // just "#": invalid
    await delay();
    expect(stripAnsi(h.lastFrame() ?? '')).toContain('hex:');
    expect(item(h.state).fg).toBe('brightWhite'); // unchanged
  });

  it('cancels hex entry on escape without changing the color', async () => {
    const h = mount(ONE);
    await delay();
    h.stdin.write('h');
    await delay();
    h.stdin.write('a'); // buffer "#a"
    await delay();
    h.stdin.write(KEY.esc);
    await delay();
    expect(stripAnsi(h.lastFrame() ?? '')).not.toContain('hex:');
    expect(item(h.state).fg).toBe('brightWhite');
  });

  it('returns to the widget editor on escape', async () => {
    const h = mount(ONE);
    await delay();
    h.stdin.write(KEY.esc);
    await delay();
    expect(h.state.screen).toBe('widgets');
  });

  it('aligns the swatch grid into fixed-width columns', async () => {
    const h = mount(ONE);
    await delay();
    const all = stripAnsi(h.lastFrame() ?? '').split('\n');
    // Grid rows only — the "inherit" entry marks the first one. Slicing past the
    // channel-label header avoids matching a color name shown there (e.g. "fg:
    // brightWhite") instead of its swatch cell.
    const lines = all.slice(all.findIndex((l) => l.includes('inherit')));
    // Labels grouped by grid column (COLS = 4). Every label in a column must
    // start at the same x, regardless of the widths of its neighbors' labels.
    const columns = [
      ['inherit', 'yellow', 'white', 'brightYellow', 'brightWhite'],
      ['black', 'blue', 'gray', 'brightBlue'],
      ['red', 'magenta', 'brightRed', 'brightMagenta'],
      ['green', 'cyan', 'brightGreen', 'brightCyan'],
    ];
    for (const labels of columns) {
      const offsets = labels.map((label) => {
        const line = lines.find((l) => l.includes(` ${label}`))!;
        expect(line, `line for ${label}`).toBeDefined();
        return line.indexOf(` ${label}`);
      });
      expect(new Set(offsets).size, labels.join(',')).toBe(1);
    }
  });

  it('shows a guard message when the focused group is empty', async () => {
    const empty: Settings = {
      style: 'powerline',
      lines: [{ left: [], right: [] }],
    };
    const h = mount(empty);
    await delay();
    expect(stripAnsi(h.lastFrame() ?? '')).toContain('No widget selected');
  });
});

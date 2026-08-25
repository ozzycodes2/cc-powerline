/**
 * LineList wiring: navigation, drill-in, add/remove line, and move mode. The
 * reducer transitions themselves are covered in reducer.test.ts; here we prove
 * the keystrokes reach the right actions and move mode gates ↑↓ into reorders.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { createElement } from 'react';
import { LineList } from '../../src/tui/LineList.js';
import { Harness } from './harness.js';
import { stripAnsi } from '../../src/render/stripAnsi.js';
import type { TuiState } from '../../src/tui/reducer.js';
import type { Settings } from '../../src/types/Settings.js';

const KEY = { down: '\x1b[B', up: '\x1b[A', enter: '\r', esc: '\x1b' };
const delay = (ms = 20) => new Promise((r) => setTimeout(r, ms));

const TWO_LINES: Settings = {
  style: 'powerline',
  lines: [
    { left: [{ type: 'model' }], right: [] },
    { left: [{ type: 'directory' }], right: [] },
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
      children: (s, dispatch) => createElement(LineList, { state: s, dispatch }),
    }),
  );
  return { ...app, get state() { return state; } };
};

describe('LineList', () => {
  it('moves the cursor and drills into a line on enter', async () => {
    const h = mount(TWO_LINES);
    await delay();
    h.stdin.write(KEY.down);
    await delay();
    expect(h.state.focus.lineIndex).toBe(1);
    h.stdin.write(KEY.enter);
    await delay();
    expect(h.state.screen).toBe('widgets');
    expect(h.state.focus).toMatchObject({ lineIndex: 1, side: 'left', itemIndex: 0 });
  });

  it('adds and removes lines', async () => {
    const h = mount(TWO_LINES);
    await delay();
    h.stdin.write('a');
    await delay();
    expect(h.state.settings.lines).toHaveLength(3);
    h.stdin.write('d');
    await delay();
    expect(h.state.settings.lines).toHaveLength(2);
  });

  it('reorders a line in move mode, then exits move mode', async () => {
    const h = mount(TWO_LINES);
    await delay();
    h.stdin.write('m'); // enter move mode on line 1
    await delay();
    expect(stripAnsi(h.lastFrame() ?? '')).toContain('MOVE');
    h.stdin.write(KEY.down); // line 1 swaps down to position 2
    await delay();
    expect(h.state.settings.lines[1]!.left[0]!.type).toBe('model');
    expect(h.state.focus.lineIndex).toBe(1);
    h.stdin.write(KEY.enter); // commit / leave move mode
    await delay();
    expect(stripAnsi(h.lastFrame() ?? '')).not.toContain('MOVE');
  });

  it('moves a line up in move mode', async () => {
    const h = mount(TWO_LINES);
    await delay();
    h.stdin.write(KEY.down); // focus line 2
    await delay();
    h.stdin.write('m');
    await delay();
    h.stdin.write(KEY.up); // line 2 -> position 1
    await delay();
    expect(h.state.settings.lines[0]!.left[0]!.type).toBe('directory');
  });

  it('returns to the menu on escape', async () => {
    const h = mount(TWO_LINES);
    await delay();
    h.stdin.write(KEY.esc);
    await delay();
    expect(h.state.screen).toBe('menu');
  });
});

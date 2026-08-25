/**
 * WidgetList wiring: side navigation, add/remove/color routing, and move mode
 * (reorder in place + ship across sides). The reducer owns the mutations and
 * focus-follows-widget behavior; these tests prove the keys map to them.
 */
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { createElement } from 'react';
import { WidgetList } from '../../src/tui/WidgetList.js';
import { Harness } from './harness.js';
import { stripAnsi } from '../../src/render/stripAnsi.js';
import { DEFAULT_SETTINGS } from '../../src/config/defaultSettings.js';
import type { TuiState } from '../../src/tui/reducer.js';
import type { Settings } from '../../src/types/Settings.js';

const KEY = { down: '\x1b[B', up: '\x1b[A', right: '\x1b[C', enter: '\r', esc: '\x1b', tab: '\t' };
const delay = (ms = 20) => new Promise((r) => setTimeout(r, ms));

const mount = (settings: Settings) => {
  let state!: TuiState;
  const app = render(
    createElement(Harness, {
      settings,
      onState: (s: TuiState) => {
        state = s;
      },
      children: (s, dispatch) => createElement(WidgetList, { state: s, dispatch }),
    }),
  );
  return { ...app, get state() { return state; } };
};

describe('WidgetList', () => {
  it('moves the item cursor and switches sides', async () => {
    const h = mount(DEFAULT_SETTINGS);
    await delay();
    h.stdin.write(KEY.down);
    await delay();
    expect(h.state.focus.itemIndex).toBe(1);
    h.stdin.write(KEY.tab);
    await delay();
    expect(h.state.focus.side).toBe('right');
  });

  it('opens the color screen on enter', async () => {
    const h = mount(DEFAULT_SETTINGS);
    await delay();
    h.stdin.write(KEY.enter);
    await delay();
    expect(h.state.screen).toBe('color');
  });

  it('opens the color screen on c', async () => {
    const h = mount(DEFAULT_SETTINGS);
    await delay();
    h.stdin.write('c');
    await delay();
    expect(h.state.screen).toBe('color');
  });

  it('opens the picker on a and removes on d', async () => {
    const h = mount(DEFAULT_SETTINGS);
    await delay();
    h.stdin.write('a');
    await delay();
    expect(h.state.screen).toBe('picker');
  });

  it('removes the focused widget on d', async () => {
    const h = mount(DEFAULT_SETTINGS);
    await delay();
    const before = h.state.settings.lines[0]!.left.length;
    h.stdin.write('d');
    await delay();
    expect(h.state.settings.lines[0]!.left).toHaveLength(before - 1);
  });

  it('reorders within a side in move mode', async () => {
    const h = mount(DEFAULT_SETTINGS);
    await delay();
    h.stdin.write('m');
    await delay();
    expect(stripAnsi(h.lastFrame() ?? '')).toContain('MOVE');
    h.stdin.write(KEY.down); // model swaps down; focus follows it
    await delay();
    expect(h.state.settings.lines[0]!.left[1]!.type).toBe('model');
    expect(h.state.focus.itemIndex).toBe(1);
    h.stdin.write(KEY.esc); // leave move mode
    await delay();
    expect(stripAnsi(h.lastFrame() ?? '')).not.toContain('MOVE');
  });

  it('ships a widget across sides in move mode with tab', async () => {
    const h = mount(DEFAULT_SETTINGS);
    await delay();
    const rightBefore = h.state.settings.lines[0]!.right.length;
    h.stdin.write('m');
    await delay();
    h.stdin.write(KEY.tab); // move-across to the right side
    await delay();
    expect(h.state.settings.lines[0]!.right).toHaveLength(rightBefore + 1);
    expect(h.state.focus.side).toBe('right');
  });

  it('returns to the lines screen on escape', async () => {
    const h = mount(DEFAULT_SETTINGS);
    await delay();
    h.stdin.write(KEY.esc);
    await delay();
    expect(h.state.screen).toBe('lines');
  });

  it('does not enter move mode or remove when the group is empty', async () => {
    const empty: Settings = { style: 'powerline', lines: [{ left: [], right: [] }] };
    const h = mount(empty);
    await delay();
    h.stdin.write('m');
    await delay();
    expect(stripAnsi(h.lastFrame() ?? '')).not.toContain('MOVE');
    h.stdin.write('d');
    await delay();
    expect(h.state.settings.lines[0]!.left).toHaveLength(0);
    h.stdin.write(KEY.enter); // nothing to color -> no navigation
    await delay();
    expect(h.state.screen).not.toBe('color');
  });
});

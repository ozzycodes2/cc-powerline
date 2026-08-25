/**
 * WidgetPicker wiring: fuzzy filter by typing, navigate the ranked results,
 * pick to append + return, cancel with escape. Ranking is covered in
 * fuzzy.test.ts and the append itself in reducer.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { createElement } from 'react';
import { WidgetPicker } from '../../src/tui/WidgetPicker.js';
import { Harness } from './harness.js';
import { stripAnsi } from '../../src/render/stripAnsi.js';
import { WIDGET_TYPES } from '../../src/widgets/registry.js';
import type { TuiState } from '../../src/tui/reducer.js';
import type { Settings } from '../../src/types/Settings.js';

const KEY = { down: '\x1b[B', enter: '\r', esc: '\x1b' };
const delay = (ms = 20) => new Promise((r) => setTimeout(r, ms));

const EMPTY: Settings = {
  style: 'powerline',
  lines: [{ left: [], right: [] }],
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
        createElement(WidgetPicker, { state: s, dispatch }),
    }),
  );
  return {
    ...app,
    get state() {
      return state;
    },
  };
};

describe('WidgetPicker', () => {
  it('appends the highlighted type and returns to the widget editor', async () => {
    const h = mount(EMPTY);
    await delay();
    h.stdin.write(KEY.down); // move to the second type
    await delay();
    h.stdin.write(KEY.enter);
    await delay();
    expect(h.state.settings.lines[0]!.left).toEqual([
      { type: WIDGET_TYPES[1] },
    ]);
    expect(h.state.screen).toBe('widgets');
  });

  it('cancels on escape without adding anything', async () => {
    const h = mount(EMPTY);
    await delay();
    h.stdin.write(KEY.esc);
    await delay();
    expect(h.state.settings.lines[0]!.left).toHaveLength(0);
    expect(h.state.screen).toBe('widgets');
  });

  it('filters by typed query and adds the top match on enter', async () => {
    const h = mount(EMPTY);
    await delay();
    for (const ch of 'branch') {
      h.stdin.write(ch);
      await delay(5);
    }
    // Rows read "Category: one-line explanation".
    expect(stripAnsi(h.lastFrame() ?? '')).toContain(
      'Git branch: Current branch name',
    );
    h.stdin.write(KEY.enter);
    await delay();
    expect(h.state.settings.lines[0]!.left).toEqual([{ type: 'git-branch' }]);
  });

  it('shows "no matches" for a query nothing satisfies', async () => {
    const h = mount(EMPTY);
    await delay();
    for (const ch of 'zzz') {
      h.stdin.write(ch);
      await delay(5);
    }
    expect(stripAnsi(h.lastFrame() ?? '')).toContain('no matches');
    h.stdin.write(KEY.enter); // nothing highlighted -> no-op
    await delay();
    expect(h.state.settings.lines[0]!.left).toHaveLength(0);
  });

  it('backspace widens the filter again', async () => {
    const h = mount(EMPTY);
    await delay();
    for (const ch of 'zzz') {
      h.stdin.write(ch);
      await delay(5);
    }
    expect(stripAnsi(h.lastFrame() ?? '')).toContain('no matches');
    for (let i = 0; i < 3; i++) {
      h.stdin.write('\x7f'); // backspace
      await delay(5);
    }
    expect(stripAnsi(h.lastFrame() ?? '')).not.toContain('no matches');
  });
});

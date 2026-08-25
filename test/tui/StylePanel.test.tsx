/**
 * StylePanel wiring: selecting a style dispatches SET_STYLE; escape returns to
 * the menu. The non-destructive switch behavior is covered in reducer.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { createElement } from 'react';
import { StylePanel } from '../../src/tui/StylePanel.js';
import { Harness } from './harness.js';
import { DEFAULT_SETTINGS } from '../../src/config/defaultSettings.js';
import type { TuiState } from '../../src/tui/reducer.js';

const KEY = { down: '\x1b[B', enter: '\r', esc: '\x1b' };
const delay = (ms = 20) => new Promise((r) => setTimeout(r, ms));

const mount = () => {
  let state!: TuiState;
  const app = render(
    createElement(Harness, {
      settings: DEFAULT_SETTINGS,
      onState: (s: TuiState) => {
        state = s;
      },
      children: (s, dispatch) =>
        createElement(StylePanel, { state: s, dispatch }),
    }),
  );
  return {
    ...app,
    get state() {
      return state;
    },
  };
};

describe('StylePanel', () => {
  it('switches to builtin on enter', async () => {
    const h = mount();
    await delay();
    h.stdin.write(KEY.down); // powerline -> builtin row
    await delay();
    h.stdin.write(KEY.enter);
    await delay();
    expect(h.state.settings.style).toBe('builtin');
  });

  it('returns to the menu on escape', async () => {
    const h = mount();
    await delay();
    h.stdin.write(KEY.esc);
    await delay();
    expect(h.state.screen).toBe('menu');
  });
});

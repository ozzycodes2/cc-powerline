/**
 * ThemePanel wiring: choosing a preset dispatches APPLY_PRESET, recoloring every
 * widget with that palette's fg + background ring; escape returns to the menu.
 * The round-robin painting itself is covered in reducer.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { createElement } from 'react';
import { ThemePanel } from '../../src/tui/ThemePanel.js';
import { Harness } from './harness.js';
import { PRESETS } from '../../src/cli/presets.js';
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
      children: (s, dispatch) => createElement(ThemePanel, { state: s, dispatch }),
    }),
  );
  return { ...app, get state() { return state; } };
};

describe('ThemePanel', () => {
  it('applies the highlighted preset to every widget', async () => {
    const h = mount();
    await delay();
    h.stdin.write(KEY.down); // move to the second preset
    await delay();
    h.stdin.write(KEY.enter);
    await delay();
    const preset = PRESETS[1]!;
    const first = h.state.settings.lines[0]!.left[0]!;
    expect(first.fg).toBe(preset.fg);
    expect(first.bg).toBe(preset.bgs[0]);
  });

  it('returns to the menu on escape', async () => {
    const h = mount();
    await delay();
    h.stdin.write(KEY.esc);
    await delay();
    expect(h.state.screen).toBe('menu');
  });
});

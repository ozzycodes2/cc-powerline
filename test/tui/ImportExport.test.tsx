/**
 * ImportExport wiring: reset-to-defaults and load-from-file both swap the config
 * in as *unsaved* (REPLACE_SETTINGS keeps the saved snapshot). The importer is
 * injected, so we drive both its success and failure paths. Path entry is a
 * small controlled text field.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { createElement } from 'react';
import { ImportExport } from '../../src/tui/ImportExport.js';
import { Harness } from './harness.js';
import { stripAnsi } from '../../src/render/stripAnsi.js';
import { DEFAULT_SETTINGS } from '../../src/config/defaultSettings.js';
import { isDirty, type TuiState } from '../../src/tui/reducer.js';
import type { Settings } from '../../src/types/Settings.js';

const KEY = { down: '\x1b[B', enter: '\r', esc: '\x1b' };
const delay = (ms = 20) => new Promise((r) => setTimeout(r, ms));

// A minimal, non-default starting config so "reset" is an observable change.
const START: Settings = { style: 'builtin', lines: [{ left: [{ type: 'model' }], right: [] }] };

const mount = (loadFrom: (p: string) => Promise<Settings>) => {
  let state!: TuiState;
  const app = render(
    createElement(Harness, {
      settings: START,
      onState: (s: TuiState) => {
        state = s;
      },
      children: (s, dispatch) => createElement(ImportExport, { state: s, dispatch, loadFrom }),
    }),
  );
  return { ...app, get state() { return state; } };
};

describe('ImportExport', () => {
  it('resets to defaults as an unsaved change', async () => {
    const h = mount(vi.fn());
    await delay();
    h.stdin.write(KEY.enter); // cursor on "Reset to defaults"
    await delay();
    expect(h.state.settings).toEqual(DEFAULT_SETTINGS);
    expect(isDirty(h.state)).toBe(true);
    expect(h.state.message).toContain('Reset');
  });

  it('loads a config from a typed path', async () => {
    const loaded: Settings = { style: 'powerline', lines: [{ left: [{ type: 'directory' }], right: [] }] };
    const loadFrom = vi.fn().mockResolvedValue(loaded);
    const h = mount(loadFrom);
    await delay();
    h.stdin.write(KEY.down); // -> "Load from file…"
    await delay();
    h.stdin.write(KEY.enter); // enter path-entry mode
    await delay();
    for (const ch of '/tmp/x.json') {
      h.stdin.write(ch);
      await delay(5);
    }
    h.stdin.write(KEY.enter);
    await delay();
    expect(loadFrom).toHaveBeenCalledWith('/tmp/x.json');
    expect(h.state.settings).toEqual(loaded);
    expect(h.state.message).toContain('Loaded');
  });

  it('surfaces an importer error without changing the config', async () => {
    const loadFrom = vi.fn().mockRejectedValue(new Error('bad json'));
    const h = mount(loadFrom);
    await delay();
    h.stdin.write(KEY.down);
    await delay();
    h.stdin.write(KEY.enter);
    await delay();
    for (const ch of 'nope') {
      h.stdin.write(ch);
      await delay(5);
    }
    h.stdin.write(KEY.enter);
    await delay();
    expect(h.state.settings).toEqual(START);
    expect(h.state.message).toContain('bad json');
  });

  it('cancels path entry on escape', async () => {
    const h = mount(vi.fn());
    await delay();
    h.stdin.write(KEY.down);
    await delay();
    h.stdin.write(KEY.enter); // path mode
    await delay();
    expect(stripAnsi(h.lastFrame() ?? '')).toContain('path:');
    h.stdin.write(KEY.esc);
    await delay();
    expect(stripAnsi(h.lastFrame() ?? '')).not.toContain('path:');
  });

  it('returns to the menu on escape from the action list', async () => {
    const h = mount(vi.fn());
    await delay();
    h.stdin.write(KEY.esc);
    await delay();
    expect(h.state.screen).toBe('menu');
  });
});

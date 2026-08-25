import { describe, it, expect } from 'vitest';
import {
  reducer,
  initialState,
  isDirty,
  clampFocus,
  type TuiState,
  type Action,
} from '../../src/tui/reducer.js';
import { presetByKey } from '../../src/cli/presets.js';
import type { Settings } from '../../src/types/Settings.js';

const base: Settings = {
  style: 'powerline',
  lines: [
    {
      left: [{ type: 'model' }, { type: 'git-branch' }],
      right: [{ type: 'session-cost' }],
    },
  ],
};

const start = (settings: Settings = base): TuiState =>
  initialState(settings, '/tmp/settings.json');

/** Apply a sequence of actions from a starting state. */
const run = (s: TuiState, ...actions: Action[]): TuiState =>
  actions.reduce(reducer, s);

describe('reducer — load & save', () => {
  it('LOAD seeds settings and saved together (not dirty)', () => {
    const s = reducer(start(), {
      type: 'LOAD',
      settings: base,
      sourcePath: '/x',
    });
    expect(s.sourcePath).toBe('/x');
    expect(isDirty(s)).toBe(false);
  });

  it('an edit makes the state dirty; SAVED clears it', () => {
    const edited = run(start(), { type: 'SET_STYLE', style: 'builtin' });
    expect(isDirty(edited)).toBe(true);
    const saved = reducer(edited, { type: 'SAVED' });
    expect(isDirty(saved)).toBe(false);
    expect(saved.message).toBe('Saved');
  });
});

describe('reducer — navigation', () => {
  it('NAVIGATE sets the screen and merges focus', () => {
    const s = reducer(start(), {
      type: 'NAVIGATE',
      screen: 'widgets',
      focus: { itemIndex: 1 },
    });
    expect(s.screen).toBe('widgets');
    expect(s.focus.itemIndex).toBe(1);
  });

  it('NAVIGATE clamps focus into range', () => {
    const s = reducer(start(), { type: 'NAVIGATE', focus: { itemIndex: 99 } });
    expect(s.focus.itemIndex).toBe(1); // left group has 2 items → max index 1
  });

  it('SET_MESSAGE sets and clears the status text', () => {
    expect(reducer(start(), { type: 'SET_MESSAGE', text: 'hi' }).message).toBe(
      'hi',
    );
    expect(
      reducer(start(), { type: 'SET_MESSAGE', text: null }).message,
    ).toBeNull();
  });
});

describe('reducer — style & theme', () => {
  it('SET_STYLE to builtin is non-destructive and reversible', () => {
    const toBuiltin = reducer(start(), { type: 'SET_STYLE', style: 'builtin' });
    expect(toBuiltin.settings.style).toBe('builtin');
    // Right widgets are preserved (not dropped) so the toggle is reversible.
    expect(toBuiltin.settings.lines[0]!.right).toHaveLength(1);
    const back = reducer(toBuiltin, { type: 'SET_STYLE', style: 'powerline' });
    expect(back.settings.lines[0]!.right).toEqual(base.lines[0]!.right);
  });

  it('SET_SEPARATOR and SET_THEME write through', () => {
    const s = run(
      start(),
      { type: 'SET_SEPARATOR', value: ' | ' },
      { type: 'SET_THEME', key: 'defaultBg', value: '#123456' },
    );
    expect(s.settings.separator).toBe(' | ');
    expect(s.settings.theme?.defaultBg).toBe('#123456');
  });
});

describe('reducer — widgets', () => {
  it('ADD_WIDGET appends by default and inserts at an index', () => {
    const appended = reducer(start(), {
      type: 'ADD_WIDGET',
      lineIndex: 0,
      side: 'left',
      widgetType: 'directory',
    });
    expect(appended.settings.lines[0]!.left.map((w) => w.type)).toEqual([
      'model',
      'git-branch',
      'directory',
    ]);
    const inserted = reducer(start(), {
      type: 'ADD_WIDGET',
      lineIndex: 0,
      side: 'left',
      widgetType: 'directory',
      at: 0,
    });
    expect(inserted.settings.lines[0]!.left[0]!.type).toBe('directory');
  });

  it('REMOVE_WIDGET drops the item and re-clamps focus', () => {
    const focused = reducer(start(), {
      type: 'NAVIGATE',
      focus: { itemIndex: 1 },
    });
    const removed = reducer(focused, {
      type: 'REMOVE_WIDGET',
      lineIndex: 0,
      side: 'left',
      itemIndex: 1,
    });
    expect(removed.settings.lines[0]!.left.map((w) => w.type)).toEqual([
      'model',
    ]);
    expect(removed.focus.itemIndex).toBe(0); // clamped from 1 → 0
  });

  it('MOVE_WIDGET reorders within a side and follows the item with focus', () => {
    const moved = reducer(start(), {
      type: 'MOVE_WIDGET',
      lineIndex: 0,
      side: 'left',
      itemIndex: 0,
      dir: 1,
    });
    expect(moved.settings.lines[0]!.left.map((w) => w.type)).toEqual([
      'git-branch',
      'model',
    ]);
    expect(moved.focus.itemIndex).toBe(1);
  });

  it('MOVE_WIDGET is a no-op at the boundary', () => {
    const s = reducer(start(), {
      type: 'MOVE_WIDGET',
      lineIndex: 0,
      side: 'left',
      itemIndex: 0,
      dir: -1,
    });
    expect(s.settings.lines[0]!.left.map((w) => w.type)).toEqual([
      'model',
      'git-branch',
    ]);
  });

  it('MOVE_WIDGET_ACROSS moves an item to the other side and moves focus with it', () => {
    const s = reducer(start(), {
      type: 'MOVE_WIDGET_ACROSS',
      lineIndex: 0,
      side: 'left',
      itemIndex: 0,
    });
    expect(s.settings.lines[0]!.left.map((w) => w.type)).toEqual([
      'git-branch',
    ]);
    expect(s.settings.lines[0]!.right.map((w) => w.type)).toEqual([
      'session-cost',
      'model',
    ]);
    expect(s.focus.side).toBe('right');
    expect(s.focus.itemIndex).toBe(1);
  });
});

describe('reducer — colors & options', () => {
  it('SET_WIDGET_COLOR sets and clears a channel', () => {
    const set = reducer(start(), {
      type: 'SET_WIDGET_COLOR',
      lineIndex: 0,
      side: 'left',
      itemIndex: 0,
      channel: 'bg',
      color: '#ff0000',
    });
    expect(set.settings.lines[0]!.left[0]!.bg).toBe('#ff0000');
    const cleared = reducer(set, {
      type: 'SET_WIDGET_COLOR',
      lineIndex: 0,
      side: 'left',
      itemIndex: 0,
      channel: 'bg',
      color: undefined,
    });
    expect(cleared.settings.lines[0]!.left[0]!.bg).toBeUndefined();
  });

  it('SET_WIDGET_OPTION merges into the options bag', () => {
    const s = run(
      start(),
      {
        type: 'SET_WIDGET_OPTION',
        lineIndex: 0,
        side: 'left',
        itemIndex: 1,
        key: 'icon',
        value: '',
      },
      {
        type: 'SET_WIDGET_OPTION',
        lineIndex: 0,
        side: 'left',
        itemIndex: 1,
        key: 'width',
        value: 10,
      },
    );
    expect(s.settings.lines[0]!.left[1]!.options).toEqual({
      icon: '',
      width: 10,
    });
  });
});

describe('reducer — lines', () => {
  it('ADD_LINE appends an empty line and focuses it', () => {
    const s = reducer(start(), { type: 'ADD_LINE' });
    expect(s.settings.lines).toHaveLength(2);
    expect(s.settings.lines[1]).toEqual({ left: [], right: [] });
    expect(s.focus.lineIndex).toBe(1);
  });

  it('REMOVE_LINE never drops the last line', () => {
    const s = reducer(start(), { type: 'REMOVE_LINE', lineIndex: 0 });
    expect(s.settings.lines).toHaveLength(1);
  });

  it('REMOVE_LINE removes a line when more than one exists and re-clamps focus', () => {
    const two = reducer(start(), { type: 'ADD_LINE' }); // focus.lineIndex → 1
    const s = reducer(two, { type: 'REMOVE_LINE', lineIndex: 1 });
    expect(s.settings.lines).toHaveLength(1);
    expect(s.focus.lineIndex).toBe(0);
  });

  it('MOVE_LINE swaps lines and follows with focus', () => {
    const two = run(
      start(),
      { type: 'ADD_LINE' },
      {
        type: 'ADD_WIDGET',
        lineIndex: 1,
        side: 'left',
        widgetType: 'directory',
      },
    );
    const s = reducer(two, { type: 'MOVE_LINE', lineIndex: 1, dir: -1 });
    expect(s.settings.lines[0]!.left[0]!.type).toBe('directory');
    expect(s.focus.lineIndex).toBe(0);
  });
});

describe('reducer — presets', () => {
  it('APPLY_PRESET paints fg on all items and round-robins bg per group', () => {
    const preset = presetByKey('mono');
    const s = reducer(start(), {
      type: 'APPLY_PRESET',
      fg: preset.fg,
      bgs: preset.bgs,
    });
    const left = s.settings.lines[0]!.left;
    expect(left[0]).toMatchObject({ fg: preset.fg, bg: preset.bgs[0] });
    expect(left[1]).toMatchObject({ fg: preset.fg, bg: preset.bgs[1] });
    // The ring restarts per group, so the right group leads with bg[0] again.
    expect(s.settings.lines[0]!.right[0]).toMatchObject({
      fg: preset.fg,
      bg: preset.bgs[0],
    });
  });

  it('APPLY_PRESET accepts an arbitrary palette (e.g. a detected theme)', () => {
    const s = reducer(start(), {
      type: 'APPLY_PRESET',
      fg: 'black',
      bgs: ['#111111', '#222222'],
    });
    const left = s.settings.lines[0]!.left;
    expect(left[0]).toMatchObject({ fg: 'black', bg: '#111111' });
    expect(left[1]).toMatchObject({ fg: 'black', bg: '#222222' });
  });
});

describe('reducer — replace settings', () => {
  const other: Settings = {
    style: 'builtin',
    lines: [{ left: [{ type: 'directory' }], right: [] }],
  };

  it('swaps settings in but leaves the saved snapshot, so it reads as dirty', () => {
    const s = reducer(start(), {
      type: 'REPLACE_SETTINGS',
      settings: other,
      message: 'Loaded',
    });
    expect(s.settings).toEqual(other);
    expect(isDirty(s)).toBe(true);
    expect(s.message).toBe('Loaded');
  });

  it('clears the message when none is given and clamps stale focus', () => {
    // Focus is deep in the old two-item line; the replacement has a shorter line.
    const deep = run(start(), {
      type: 'NAVIGATE',
      screen: 'widgets',
      focus: { lineIndex: 0, side: 'right', itemIndex: 0 },
    });
    const s = reducer(deep, { type: 'REPLACE_SETTINGS', settings: other });
    expect(s.message).toBeNull();
    // `other`'s right group is empty, so the stale itemIndex is clamped back to 0.
    expect(s.focus.itemIndex).toBe(0);
  });
});

describe('clampFocus', () => {
  it('resets to origin when there are no lines', () => {
    expect(
      clampFocus(
        { style: 'powerline', lines: [] },
        { lineIndex: 3, side: 'right', itemIndex: 5 },
      ),
    ).toEqual({
      lineIndex: 0,
      side: 'right',
      itemIndex: 0,
    });
  });
});

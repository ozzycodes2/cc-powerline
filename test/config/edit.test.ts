import { describe, it, expect } from 'vitest';
import {
  addLine,
  addWidget,
  applyPalette,
  moveLine,
  moveWidget,
  moveWidgetAcross,
  removeLine,
  removeWidget,
  setWidgetColor,
  setWidgetOption,
} from '../../src/config/edit.js';
import { SettingsSchema, type Settings } from '../../src/types/Settings.js';

const parse = (raw: unknown): Settings => SettingsSchema.parse(raw);

const twoLeft = () =>
  parse({
    lines: [{ left: [{ type: 'model' }, { type: 'directory' }], right: [] }],
  });

describe('addWidget', () => {
  it('appends by default', () => {
    const r = addWidget(twoLeft(), 0, 'left', 'git-branch');
    expect(r.lines[0]!.left.map((i) => i.type)).toEqual([
      'model',
      'directory',
      'git-branch',
    ]);
  });

  it('inserts at a clamped index', () => {
    const r = addWidget(twoLeft(), 0, 'left', 'git-branch', 1);
    expect(r.lines[0]!.left.map((i) => i.type)).toEqual([
      'model',
      'git-branch',
      'directory',
    ]);
    const clamped = addWidget(twoLeft(), 0, 'left', 'git-branch', 99);
    expect(clamped.lines[0]!.left.at(-1)!.type).toBe('git-branch');
  });

  it('is a no-op for an unknown line', () => {
    const s = twoLeft();
    expect(addWidget(s, 5, 'left', 'git-branch')).toBe(s);
  });
});

describe('removeWidget', () => {
  it('drops the item', () => {
    const r = removeWidget(twoLeft(), 0, 'left', 0);
    expect(r.lines[0]!.left.map((i) => i.type)).toEqual(['directory']);
  });

  it('no-ops on an out-of-range item', () => {
    const s = twoLeft();
    expect(removeWidget(s, 0, 'left', 9)).toEqual(s);
  });
});

describe('moveWidget', () => {
  it('swaps with the neighbour', () => {
    const r = moveWidget(twoLeft(), 0, 'left', 0, 1);
    expect(r.lines[0]!.left.map((i) => i.type)).toEqual(['directory', 'model']);
  });

  it('no-ops off either end', () => {
    const s = twoLeft();
    expect(moveWidget(s, 0, 'left', 0, -1)).toEqual(s);
    expect(moveWidget(s, 0, 'left', 1, 1)).toEqual(s);
  });
});

describe('moveWidgetAcross', () => {
  it('moves to the end of the opposite group', () => {
    const r = moveWidgetAcross(twoLeft(), 0, 'left', 0);
    expect(r.lines[0]!.left.map((i) => i.type)).toEqual(['directory']);
    expect(r.lines[0]!.right.map((i) => i.type)).toEqual(['model']);
  });

  it('moves from the right group back to the left', () => {
    const s = parse({
      lines: [{ left: [{ type: 'model' }], right: [{ type: 'directory' }] }],
    });
    const r = moveWidgetAcross(s, 0, 'right', 0);
    expect(r.lines[0]!.left.map((i) => i.type)).toEqual(['model', 'directory']);
    expect(r.lines[0]!.right).toEqual([]);
  });

  it('no-ops on an out-of-range item', () => {
    const s = twoLeft();
    expect(moveWidgetAcross(s, 0, 'left', 9)).toEqual(s);
  });
});

describe('setWidgetColor', () => {
  it('sets and clears a channel', () => {
    const set = setWidgetColor(twoLeft(), 0, 'left', 0, 'fg', 'red');
    expect(set.lines[0]!.left[0]!.fg).toBe('red');
    const cleared = setWidgetColor(set, 0, 'left', 0, 'fg', undefined);
    expect(cleared.lines[0]!.left[0]!.fg).toBeUndefined();
  });

  it('no-ops on an out-of-range item', () => {
    const s = twoLeft();
    expect(setWidgetColor(s, 0, 'left', 9, 'fg', 'red')).toEqual(s);
  });
});

describe('setWidgetOption', () => {
  it('merges an option key without dropping the others', () => {
    const withIcon = setWidgetOption(twoLeft(), 0, 'left', 0, 'icon', 'X');
    const withMode = setWidgetOption(withIcon, 0, 'left', 0, 'mode', 'full');
    expect(withMode.lines[0]!.left[0]!.options).toEqual({
      icon: 'X',
      mode: 'full',
    });
  });
});

describe('line ops', () => {
  it('adds a line', () => {
    expect(addLine(twoLeft()).lines).toHaveLength(2);
  });

  it('removes a line but never the last', () => {
    const two = addLine(twoLeft());
    expect(removeLine(two, 1).lines).toHaveLength(1);
    const one = twoLeft();
    expect(removeLine(one, 0)).toBe(one);
  });

  it('moves a line and no-ops off the ends', () => {
    const two = parse({
      lines: [{ left: [{ type: 'model' }] }, { left: [{ type: 'directory' }] }],
    });
    const moved = moveLine(two, 0, 1);
    expect(moved.lines[0]!.left[0]!.type).toBe('directory');
    expect(moveLine(two, 0, -1)).toBe(two);
  });
});

describe('applyPalette re-export', () => {
  it('is available from the algebra module', () => {
    const r = applyPalette(twoLeft(), { fg: 'white', bgs: ['red'] });
    expect(r.lines[0]!.left.every((i) => i.fg === 'white')).toBe(true);
  });
});

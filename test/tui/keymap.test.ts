import { describe, it, expect } from 'vitest';
import {
  navDirection,
  moveCursor,
  gridMove,
  isEnter,
  isBack,
  isQuit,
  isSave,
  isHelp,
  isRemove,
} from '../../src/tui/keymap.js';

describe('navDirection', () => {
  it('maps arrow keys and vi keys to directions', () => {
    expect(navDirection('', { upArrow: true })).toBe('up');
    expect(navDirection('', { downArrow: true })).toBe('down');
    expect(navDirection('', { leftArrow: true })).toBe('left');
    expect(navDirection('', { rightArrow: true })).toBe('right');
    expect(navDirection('k', {})).toBe('up');
    expect(navDirection('j', {})).toBe('down');
    expect(navDirection('h', {})).toBe('left');
    expect(navDirection('l', {})).toBe('right');
    expect(navDirection('x', {})).toBeNull();
  });
});

describe('moveCursor', () => {
  it('wraps around both ends', () => {
    expect(moveCursor(0, 'up', 3)).toBe(2);
    expect(moveCursor(2, 'down', 3)).toBe(0);
    expect(moveCursor(1, 'left', 3)).toBe(0);
    expect(moveCursor(1, 'right', 3)).toBe(2);
  });

  it('is a no-op for null direction or empty list', () => {
    expect(moveCursor(1, null, 3)).toBe(1);
    expect(moveCursor(0, 'down', 0)).toBe(0);
  });
});

describe('gridMove', () => {
  // A 4-column grid over 10 cells: rows [0-3][4-7][8-9].
  it('steps one cell left/right and a full row up/down', () => {
    expect(gridMove(5, 'left', 10, 4)).toBe(4);
    expect(gridMove(5, 'right', 10, 4)).toBe(6);
    expect(gridMove(5, 'up', 10, 4)).toBe(1);
    expect(gridMove(5, 'down', 10, 4)).toBe(9);
  });

  it('clamps at the walls instead of wrapping', () => {
    expect(gridMove(0, 'left', 10, 4)).toBe(0); // first cell, no left
    expect(gridMove(9, 'right', 10, 4)).toBe(9); // last cell, no right
    expect(gridMove(1, 'up', 10, 4)).toBe(1); // top row, no up
    expect(gridMove(8, 'down', 10, 4)).toBe(8); // moving down would overshoot
  });

  it('is a no-op for null direction or empty grid', () => {
    expect(gridMove(3, null, 10, 4)).toBe(3);
    expect(gridMove(0, 'down', 0, 4)).toBe(0);
  });
});

describe('intent helpers', () => {
  it('classify enter / back / quit / save / help / remove', () => {
    expect(isEnter({ return: true })).toBe(true);
    expect(isBack({ escape: true })).toBe(true);
    expect(isQuit('q', {})).toBe(true);
    expect(isQuit('c', { ctrl: true })).toBe(true);
    expect(isQuit('a', {})).toBe(false);
    expect(isSave('s', { ctrl: true })).toBe(true);
    expect(isSave('s', {})).toBe(false);
    expect(isHelp('?')).toBe(true);
    expect(isRemove('d', {})).toBe(true);
    expect(isRemove('', { delete: true })).toBe(true);
    expect(isRemove('', { backspace: true })).toBe(true);
    expect(isRemove('x', {})).toBe(false);
  });
});

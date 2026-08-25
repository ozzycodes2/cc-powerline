import { describe, it, expect } from 'vitest';
import { renderBuiltin } from '../../src/render/builtinRenderer.js';
import { stripAnsi } from '../../src/render/stripAnsi.js';
import type { LineGroups } from '../../src/render/types.js';

describe('renderBuiltin', () => {
  it('joins left segments with the default separator', () => {
    const groups: LineGroups = {
      left: [{ text: 'model' }, { text: 'main' }, { text: '42%' }],
      right: [],
    };
    expect(renderBuiltin(groups)).toBe('model  main  42%');
  });

  it('ignores the right group entirely', () => {
    const groups: LineGroups = {
      left: [{ text: 'model' }],
      right: [{ text: 'SHOULD-NOT-APPEAR' }],
    };
    expect(renderBuiltin(groups)).toBe('model');
  });

  it('skips hidden and empty segments', () => {
    const groups: LineGroups = {
      left: [
        { text: 'a' },
        { text: '', hidden: false },
        { text: 'b', hidden: true },
        { text: 'c' },
      ],
      right: [],
    };
    expect(renderBuiltin(groups)).toBe('a  c');
  });

  it('applies foreground color but no background', () => {
    const groups: LineGroups = {
      left: [{ text: 'x', fg: 'red', bg: 'blue' }],
      right: [],
    };
    const out = renderBuiltin(groups);
    expect(stripAnsi(out)).toBe('x');
    expect(out).toContain('\x1b[31m'); // fg red
    expect(out).not.toContain('44'); // no bg blue
  });

  it('honors a custom separator', () => {
    const groups: LineGroups = {
      left: [{ text: 'a' }, { text: 'b' }],
      right: [],
    };
    expect(renderBuiltin(groups, { separator: ' | ' })).toBe('a | b');
  });
});

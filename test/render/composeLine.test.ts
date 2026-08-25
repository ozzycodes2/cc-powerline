import { describe, it, expect } from 'vitest';
import { composeLine } from '../../src/render/composeLine.js';
import { visibleWidth } from '../../src/render/stripAnsi.js';
import type { RenderedGroup } from '../../src/render/types.js';

const g = (text: string): RenderedGroup => ({ text, width: text.length });

describe('composeLine', () => {
  it('pads the gap so the right group is right-anchored', () => {
    const line = composeLine({ left: g('LEFT'), right: g('RIGHT'), width: 20 });
    expect(line).toBe('LEFT' + ' '.repeat(11) + 'RIGHT');
    expect(visibleWidth(line)).toBe(20);
  });

  it('joins with no gap when the groups exactly fill the width', () => {
    const line = composeLine({ left: g('LEFT'), right: g('RIGHT'), width: 9 });
    expect(line).toBe('LEFTRIGHT');
  });

  it('returns just the left group (truncated) when there is no right group', () => {
    expect(
      composeLine({ left: g('hello world'), right: g(''), width: 20 }),
    ).toBe('hello world');
    expect(
      composeLine({ left: g('hello world'), right: g(''), width: 5 }),
    ).toBe('hello');
  });

  it('truncates the left group on overflow, preserving the right group', () => {
    const line = composeLine({
      left: g('a-really-long-left-side'),
      right: g('RIGHT'),
      width: 12,
    });
    // right (5) kept in full; left gets width - 5 - 1 = 6, plus a separating space.
    expect(line).toBe('a-real RIGHT');
    expect(visibleWidth(line)).toBe(12);
  });

  it('drops the left group when even the right group barely fits', () => {
    const line = composeLine({
      left: g('LEFT'),
      right: g('RIGHTSIDE'),
      width: 9,
    });
    expect(line).toBe('RIGHTSIDE');
  });

  it('truncates the right group when it alone overflows the width', () => {
    const line = composeLine({
      left: g('LEFT'),
      right: g('RIGHTSIDE'),
      width: 5,
    });
    expect(visibleWidth(line)).toBe(5);
    expect(line).toBe('RIGHT');
  });
});

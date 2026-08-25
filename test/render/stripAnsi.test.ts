import { describe, it, expect } from 'vitest';
import {
  stripAnsi,
  visibleWidth,
  truncateToWidth,
} from '../../src/render/stripAnsi.js';

const RED = '\x1b[31m';
const RESET = '\x1b[0m';

describe('stripAnsi / visibleWidth', () => {
  it('removes SGR escapes', () => {
    expect(stripAnsi(`${RED}hello${RESET}`)).toBe('hello');
  });

  it('measures visible width ignoring escapes', () => {
    expect(visibleWidth(`${RED}hello${RESET}`)).toBe(5);
    expect(visibleWidth('plain')).toBe(5);
  });
});

describe('truncateToWidth', () => {
  it('returns the input unchanged when it fits', () => {
    expect(truncateToWidth('hello', 10)).toBe('hello');
  });

  it('truncates plain text to the width', () => {
    expect(truncateToWidth('hello world', 5)).toBe('hello');
  });

  it('returns empty for a non-positive width', () => {
    expect(truncateToWidth('hello', 0)).toBe('');
  });

  it('preserves escapes and appends a reset when cutting colored text', () => {
    const out = truncateToWidth(`${RED}hello world${RESET}`, 5);
    expect(visibleWidth(out)).toBe(5);
    expect(stripAnsi(out)).toBe('hello');
    expect(out.startsWith(RED)).toBe(true);
    expect(out.endsWith(RESET)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  basename,
  compressPath,
  formatCost,
  formatDuration,
  formatMoney,
  formatPercent,
} from '../../src/widgets/format.js';

describe('formatCost', () => {
  it('formats sub-dollar to 4dp, dollar+ to 2dp, and non-positive to $0.00', () => {
    expect(formatCost(0.1234)).toBe('$0.1234');
    expect(formatCost(2)).toBe('$2.00');
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(-1)).toBe('$0.00');
    expect(formatCost(Number.NaN)).toBe('$0.00');
  });
});

describe('formatMoney', () => {
  it('shows dust as <1¢, sub-dollar as cents, and a dollar or more as $D.CC', () => {
    expect(formatMoney(0.004)).toBe('<1¢'); // rounds to 0 cents
    expect(formatMoney(0)).toBe('<1¢');
    expect(formatMoney(-1)).toBe('<1¢');
    expect(formatMoney(Number.NaN)).toBe('<1¢');
    expect(formatMoney(0.2)).toBe('20¢');
    expect(formatMoney(0.005)).toBe('1¢'); // rounds up to a cent
    expect(formatMoney(0.999)).toBe('$1.00'); // rounds up across the dollar
    expect(formatMoney(4)).toBe('$4.00');
    expect(formatMoney(12.05)).toBe('$12.05');
  });
});

describe('formatPercent', () => {
  it('rounds to a whole percent', () => {
    expect(formatPercent(42.4)).toBe('42%');
    expect(formatPercent(42.6)).toBe('43%');
  });
});

describe('basename', () => {
  it('returns the trailing component across separators and trailing slashes', () => {
    expect(basename('/a/b/c')).toBe('c');
    expect(basename('a\\b\\c\\')).toBe('c');
    expect(basename('solo')).toBe('solo');
  });
});

describe('compressPath', () => {
  it('shortens parents to one char and keeps the last segment', () => {
    expect(compressPath('/Users/me/Documents/work/proj')).toBe('/U/m/D/w/proj');
  });

  it('substitutes ~ for the home directory', () => {
    expect(compressPath('/Users/me/Documents/work/proj', '/Users/me')).toBe('~/D/w/proj');
    expect(compressPath('/Users/me', '/Users/me')).toBe('~');
  });

  it('preserves a leading slash for absolute paths and keeps relative paths relative', () => {
    expect(compressPath('/aa/bb/cc')).toBe('/a/b/cc');
    expect(compressPath('aa/bb/cc')).toBe('a/b/cc');
    expect(compressPath('/')).toBe('/');
  });

  it('ignores a home that does not prefix the path', () => {
    expect(compressPath('/var/log/app', '/Users/me')).toBe('/v/l/app');
  });
});

describe('formatDuration', () => {
  it('formats M:SS under an hour and H:MM past it, flooring negatives to 0:00', () => {
    expect(formatDuration(4 * 60_000 + 12_000)).toBe('4:12');
    expect(formatDuration(9_000)).toBe('0:09');
    expect(formatDuration(60 * 60_000 + 5 * 60_000)).toBe('1:05');
    expect(formatDuration(-5000)).toBe('0:00');
  });
});

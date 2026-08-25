import { describe, it, expect } from 'vitest';
import { fuzzyScore, fuzzyFilter } from '../../src/tui/fuzzy.js';
import { WIDGET_CATALOG, choiceSearchText } from '../../src/tui/catalog.js';

describe('fuzzyScore', () => {
  it('returns 0 for an empty query (matches everything)', () => {
    expect(fuzzyScore('', 'anything')).toBe(0);
  });

  it('returns null when the query is not a subsequence', () => {
    expect(fuzzyScore('xyz', 'git-branch')).toBeNull();
    expect(fuzzyScore('bran', 'git')).toBeNull();
  });

  it('scores a subsequence match and is case-insensitive', () => {
    expect(fuzzyScore('git', 'GIT-branch')).toBeGreaterThan(0);
  });

  it('ranks a word-boundary match above a scattered one', () => {
    // "gb" hits the start of both words in git-branch...
    const branch = fuzzyScore('gb', 'git-branch')!;
    // ...but in git-changes the "b" is missing entirely.
    expect(fuzzyScore('gb', 'git-changes')).toBeNull();
    // A contiguous prefix outranks a boundary-only hit.
    expect(fuzzyScore('git', 'git-branch')!).toBeGreaterThan(branch);
  });
});

describe('fuzzyFilter', () => {
  it('returns every item unchanged for an empty query', () => {
    const out = fuzzyFilter('', WIDGET_CATALOG, choiceSearchText);
    expect(out).toEqual(WIDGET_CATALOG);
  });

  it('filters and ranks widgets by the query', () => {
    const out = fuzzyFilter('git', WIDGET_CATALOG, choiceSearchText);
    expect(out.map((c) => c.type)).toEqual(
      expect.arrayContaining(['git-branch', 'git-changes']),
    );
    expect(out.every((c) => c.type.includes('git'))).toBe(true);
  });

  it('surfaces the best match first', () => {
    const out = fuzzyFilter('cache', WIDGET_CATALOG, choiceSearchText);
    expect(out[0]!.type.startsWith('cache')).toBe(true);
  });

  it('returns nothing when no widget matches', () => {
    expect(fuzzyFilter('zzzzz', WIDGET_CATALOG, choiceSearchText)).toEqual([]);
  });
});

/**
 * A tiny subsequence fuzzy matcher — enough to filter the ~dozen widget types
 * without pulling in a dependency. `fuzzyScore` returns null when the query is
 * not a subsequence of the text, otherwise a score where higher is better:
 * consecutive matches and matches at the start / at word boundaries are
 * rewarded, so "gb" ranks "git-branch" above "git-changes".
 */

/** Score `text` against `query`, or null if `query` isn't a subsequence of it. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) {
    return 0;
  }

  let score = 0;
  let qi = 0;
  let prevMatch = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) {
      continue;
    }
    // Base point for the match, plus bonuses for where it landed.
    score += 1;
    if (ti === prevMatch + 1) {
      score += 3; // contiguous with the previous match
    }
    if (ti === 0) {
      score += 4; // very start of the text
    } else if (t[ti - 1] === '-' || t[ti - 1] === ' ' || t[ti - 1] === '_') {
      score += 2; // start of a word
    }
    prevMatch = ti;
    qi++;
  }
  return qi === q.length ? score : null;
}

export interface Scored<T> {
  item: T;
  score: number;
}

/**
 * Keep only items whose text is a subsequence of `query`, ranked best-first.
 * Ties preserve the input order (stable), so an empty query returns everything
 * untouched.
 */
export function fuzzyFilter<T>(
  query: string,
  items: T[],
  toText: (item: T) => string,
): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score: fuzzyScore(query, toText(item)),
    }))
    .filter(
      (r): r is { item: T; index: number; score: number } => r.score !== null,
    )
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}

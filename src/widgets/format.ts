/** Small formatting helpers shared by widgets. */

/** Format a USD cost: `$0.00`, sub-dollar to 4 dp, else 2 dp. */
export function formatCost(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return '$0.00';
  }
  return n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

/** Round to a whole-percent string, e.g. `42%`. */
export function formatPercent(n: number): string {
  return `${Math.round(n)}%`;
}

/** Trailing path component, tolerant of both separators and trailing slashes. */
export function basename(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : path;
}

/**
 * Compress a path the way a powerline prompt does: substitute `~` for the home
 * directory, shorten every intermediate segment to its first character, and
 * keep the final segment in full — `/Users/me/Documents/work/proj` →
 * `~/D/w/proj`. An absolute path keeps its leading `/`.
 */
export function compressPath(path: string, home?: string): string {
  const isAbs = path.startsWith('/') || path.startsWith('\\');
  let rest = path;
  let prefix = '';
  if (home && home.length > 0 && (path === home || path.startsWith(`${home}/`) || path.startsWith(`${home}\\`))) {
    rest = path.slice(home.length);
    prefix = '~';
  }
  const parts = rest.split(/[/\\]/).filter(Boolean);
  if (parts.length === 0) {
    return prefix || (isAbs ? '/' : path);
  }
  const last = parts[parts.length - 1]!;
  const head = parts.slice(0, -1).map((s) => s[0]!);
  const body = [...head, last].join('/');
  if (prefix) {
    return `${prefix}/${body}`;
  }
  return isAbs ? `/${body}` : body;
}

/** Format a millisecond span as a clock countdown: `M:SS`, or `H:MM` past an hour. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}` : `${m}:${pad(s)}`;
}

/** Read an optional string option with a default. */
export function optString(
  options: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  const v = options?.[key];
  return typeof v === 'string' ? v : fallback;
}

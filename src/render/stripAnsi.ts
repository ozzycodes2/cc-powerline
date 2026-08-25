/**
 * ANSI-aware width measurement and truncation. v1 measures visible width as
 * `.length` after stripping escape sequences — ASCII-safe, no CJK/emoji
 * double-width handling (see the plan's open question).
 */

// CSI sequences (colors/cursor). Broad enough for the SGR codes we emit.
const ANSI_PATTERN = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Remove ANSI escape sequences from a string. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

/** Visible width of a string, ignoring ANSI escapes. */
export function visibleWidth(text: string): number {
  return stripAnsi(text).length;
}

/**
 * Truncate to at most `maxWidth` visible columns, preserving ANSI escape
 * sequences (they don't count toward width) and appending a reset so a
 * mid-color cut can't bleed into the rest of the line. Returns the input
 * unchanged when it already fits.
 */
export function truncateToWidth(text: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return '';
  }
  if (visibleWidth(text) <= maxWidth) {
    return text;
  }
  const RESET = '\x1b[0m';
  let out = '';
  let width = 0;
  let hadEscape = false;
  for (let i = 0; i < text.length; ) {
    if (text[i] === '\x1b') {
      const match = text.slice(i).match(/^\x1b\[[0-9;]*[A-Za-z]/);
      if (match) {
        out += match[0];
        i += match[0].length;
        hadEscape = true;
        continue;
      }
    }
    if (width >= maxWidth) {
      break;
    }
    out += text[i];
    width += 1;
    i += 1;
  }
  return hadEscape ? out + RESET : out;
}

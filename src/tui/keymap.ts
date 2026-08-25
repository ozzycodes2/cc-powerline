/**
 * Keybinding vocabulary for the TUI, in one place so the bindings are declared
 * once and the help footer can never drift from what `useInput` actually does.
 * Ink's `useInput` hands us `(input, key)`; these helpers classify that pair
 * into the intents the components care about.
 */

/** Ink's `Key` object — only the flags we read, structurally typed. */
export interface KeyFlags {
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  return?: boolean;
  escape?: boolean;
  tab?: boolean;
  backspace?: boolean;
  delete?: boolean;
  ctrl?: boolean;
}

export type NavDir = 'up' | 'down' | 'left' | 'right' | null;

/** Arrow keys plus vi-style `k`/`j`/`h`/`l`. */
export function navDirection(input: string, key: KeyFlags): NavDir {
  if (key.upArrow || input === 'k') return 'up';
  if (key.downArrow || input === 'j') return 'down';
  if (key.leftArrow || input === 'h') return 'left';
  if (key.rightArrow || input === 'l') return 'right';
  return null;
}

export const isEnter = (key: KeyFlags): boolean => Boolean(key.return);
export const isBack = (key: KeyFlags): boolean => Boolean(key.escape);
export const isQuit = (input: string, key: KeyFlags): boolean =>
  input === 'q' || (Boolean(key.ctrl) && input === 'c');
export const isSave = (input: string, key: KeyFlags): boolean =>
  Boolean(key.ctrl) && input === 's';
export const isHelp = (input: string): boolean => input === '?';
export const isRemove = (input: string, key: KeyFlags): boolean =>
  input === 'd' || Boolean(key.delete) || Boolean(key.backspace);

/** Move a cursor within `[0, length)`, wrapping at the ends. */
export function moveCursor(
  cursor: number,
  dir: NavDir,
  length: number,
): number {
  if (length === 0) return 0;
  if (dir === 'up' || dir === 'left') return (cursor - 1 + length) % length;
  if (dir === 'down' || dir === 'right') return (cursor + 1) % length;
  return cursor;
}

/**
 * Move a cursor over a row-major grid of `cols` columns. Left/right step one
 * cell; up/down step a full row. Unlike {@link moveCursor} this clamps rather
 * than wraps — a swatch grid reads more naturally when the edges are walls —
 * and never lands past the last (possibly short) row.
 */
export function gridMove(
  cursor: number,
  dir: NavDir,
  length: number,
  cols: number,
): number {
  if (length === 0) return 0;
  if (dir === 'left') return cursor > 0 ? cursor - 1 : cursor;
  if (dir === 'right') return cursor < length - 1 ? cursor + 1 : cursor;
  if (dir === 'up') return cursor - cols >= 0 ? cursor - cols : cursor;
  if (dir === 'down') return cursor + cols < length ? cursor + cols : cursor;
  return cursor;
}

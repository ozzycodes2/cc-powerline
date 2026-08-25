/**
 * Minimal prompt helpers — a numbered-choice CLI, not a full-screen TUI. All
 * IO goes through an injectable {@link PromptIO} so the wizard is unit-testable
 * with scripted answers instead of a real terminal.
 */
import { createInterface } from 'node:readline/promises';

export interface PromptIO {
  /** Ask a question, resolving with the user's raw line (already trimmed). */
  ask: (question: string) => Promise<string>;
  /** Emit a line of guidance (menus, headers). */
  write: (text: string) => void;
  close: () => void;
}

export interface Choice<T> {
  label: string;
  value: T;
  /** Pre-checked in a multi-select. */
  checked?: boolean;
}

/** readline-backed IO over stdin/stdout. Used when no IO is injected. */
export function readlineIO(): PromptIO {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: async (question) => (await rl.question(question)).trim(),
    write: (text) => process.stdout.write(`${text}\n`),
    close: () => rl.close(),
  };
}

function renderMenu<T>(
  io: PromptIO,
  message: string,
  choices: Choice<T>[],
): void {
  io.write(message);
  choices.forEach((c, i) => io.write(`  ${i + 1}) ${c.label}`));
}

/** Parse a 1-based index string against the choice count; null if invalid. */
function parseIndex(raw: string, count: number): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : null;
}

/**
 * Ask for a whole number in `[min, max]`. Empty, non-numeric, or out-of-range
 * input falls back to `def`, so the wizard never stalls on a fat-fingered
 * count.
 */
export async function promptNumber(
  io: PromptIO,
  message: string,
  opts: { def: number; min: number; max: number },
): Promise<number> {
  const raw = await io.ask(
    `${message} [${opts.min}-${opts.max}] (default ${opts.def}): `,
  );
  if (raw === '') {
    return opts.def;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= opts.min && n <= opts.max ? n : opts.def;
}

/**
 * Ask a yes/no question. Empty input takes `def`; a leading `y`/`n` (any case)
 * decides; anything else also falls back to `def`, so a stray keystroke never
 * stalls the wizard.
 */
export async function confirm(
  io: PromptIO,
  message: string,
  def = true,
): Promise<boolean> {
  const hint = def ? 'Y/n' : 'y/N';
  const raw = (await io.ask(`${message} [${hint}]: `)).toLowerCase();
  if (raw.startsWith('y')) {
    return true;
  }
  if (raw.startsWith('n')) {
    return false;
  }
  return def;
}

/** Pick exactly one choice. Empty or invalid input selects `defaultIndex`. */
export async function select<T>(
  io: PromptIO,
  message: string,
  choices: Choice<T>[],
  defaultIndex = 0,
): Promise<T> {
  renderMenu(io, message, choices);
  const raw = await io.ask(
    `Choose [1-${choices.length}] (default ${defaultIndex + 1}): `,
  );
  const idx = raw === '' ? defaultIndex : parseIndex(raw, choices.length);
  return choices[idx ?? defaultIndex]!.value;
}

/**
 * Pick any number of choices, order preserved. Empty input keeps the
 * pre-checked defaults; otherwise a comma/space-separated list of indices
 * (out-of-range entries are ignored, duplicates collapsed).
 */
export async function multiSelect<T>(
  io: PromptIO,
  message: string,
  choices: Choice<T>[],
): Promise<T[]> {
  renderMenu(io, message, choices);
  const raw = await io.ask('Choose (comma-separated, empty = defaults): ');
  if (raw === '') {
    return choices.filter((c) => c.checked).map((c) => c.value);
  }
  const picked = new Set<number>();
  for (const token of raw.split(/[\s,]+/)) {
    const idx = parseIndex(token, choices.length);
    if (idx !== null) {
      picked.add(idx);
    }
  }
  return [...picked].sort((a, b) => a - b).map((i) => choices[i]!.value);
}

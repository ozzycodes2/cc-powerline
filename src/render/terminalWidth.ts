/**
 * Terminal width detection. Claude Code spawns the statusline command with
 * piped stdio, so `process.stdout.columns` is usually `undefined`. Technique
 * ported from `ccstatusline/src/utils/terminal.ts`: walk up the process
 * ancestry until one owns a real TTY, read its width via `stty`, then fall
 * back to `tput cols`, then a fixed default. `CC_POWERLINE_WIDTH` overrides
 * everything.
 */
import { execFileSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';

export const DEFAULT_WIDTH = 80;
const MAX_ANCESTORS = 8;

/**
 * Columns Claude Code keeps for its own statusline chrome. It renders the line
 * inside a UI with built-in horizontal spacing, so the usable width is a few
 * columns short of the terminal; drawing to the full width overflows and the
 * right group is clipped. Matches ccstatusline's `detectedWidth - 6` fill mode.
 */
export const CLAUDE_CODE_RESERVED_COLUMNS = 6;

/** Injectable side effects so the walk is unit-testable. */
export interface WidthDeps {
  env: NodeJS.ProcessEnv;
  stdoutColumns: number | undefined;
  platform: NodeJS.Platform;
  pid: number;
  /**
   * Run a command with args passed as an argv array (via `execve`, never a
   * shell). When `stdinDevice` is given, that device is opened read-only and
   * wired to the child's stdin — this replaces the `stty size < /dev/…` shell
   * redirection without reintroducing a shell. Returns trimmed stdout, or null
   * on any failure.
   */
  exec: (file: string, args: string[], stdinDevice?: string) => string | null;
}

/** Parse a `stty size` line ("rows cols") into a column count. */
export function parseSttySize(output: string | null): number | null {
  if (!output) {
    return null;
  }
  const parts = output.trim().split(/\s+/);
  if (parts.length < 2) {
    return null;
  }
  const cols = Number(parts[1]);
  return Number.isInteger(cols) && cols > 0 ? cols : null;
}

/** Normalize a `ps -o tty=` value to a `/dev` path, or null if there's no TTY. */
export function ttyToDevice(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  const tty = raw.trim();
  if (!tty || tty === '?' || tty === '??' || tty === '-') {
    return null;
  }
  return tty.startsWith('/dev/') ? tty : `/dev/${tty}`;
}

function positiveInt(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function widthFromDevice(
  device: string,
  platform: NodeJS.Platform,
  exec: WidthDeps['exec'],
): number | null {
  // stty flag for "operate on this device" differs by platform.
  const flag = platform === 'linux' ? '-F' : '-f';
  return (
    parseSttySize(exec('stty', [flag, device, 'size'])) ??
    parseSttySize(exec('stty', ['size'], device))
  );
}

/**
 * Detect the terminal width. Order: `CC_POWERLINE_WIDTH` → a real stdout TTY →
 * ancestor-process TTY probe → `tput cols` → `DEFAULT_WIDTH`. Windows skips
 * the POSIX probing.
 */
export function detectTerminalWidth(
  overrides: Partial<WidthDeps> = {},
): number {
  const deps: WidthDeps = {
    env: process.env,
    stdoutColumns: process.stdout.columns,
    platform: process.platform,
    pid: process.pid,
    exec: (file, args, stdinDevice) => {
      let fd: number | undefined;
      try {
        const stdin =
          stdinDevice !== undefined
            ? (fd = openSync(stdinDevice, 'r'))
            : 'ignore';
        return execFileSync(file, args, {
          stdio: [stdin, 'pipe', 'ignore'],
        })
          .toString()
          .trim();
      } catch {
        return null;
      } finally {
        if (fd !== undefined) {
          closeSync(fd);
        }
      }
    },
    ...overrides,
  };

  const override = positiveInt(deps.env.CC_POWERLINE_WIDTH);
  if (override) {
    return override;
  }

  if (deps.stdoutColumns && deps.stdoutColumns > 0) {
    return deps.stdoutColumns;
  }

  if (deps.platform === 'win32') {
    return DEFAULT_WIDTH;
  }

  let pid = deps.pid;
  for (let i = 0; i < MAX_ANCESTORS && pid > 1; i += 1) {
    const device = ttyToDevice(
      deps.exec('ps', ['-o', 'tty=', '-p', String(pid)]),
    );
    if (device) {
      const cols = widthFromDevice(device, deps.platform, deps.exec);
      if (cols) {
        return cols;
      }
    }
    const ppid = Number(
      (deps.exec('ps', ['-o', 'ppid=', '-p', String(pid)]) ?? '').trim(),
    );
    if (!Number.isInteger(ppid) || ppid <= 1 || ppid === pid) {
      break;
    }
    pid = ppid;
  }

  const tput = positiveInt(deps.exec('tput', ['cols']) ?? undefined);
  if (tput) {
    return tput;
  }

  return DEFAULT_WIDTH;
}

/**
 * The width to render a Claude Code statusline at: the detected terminal width
 * minus the columns Claude Code reserves for its own chrome, so the right group
 * never spills past the visible edge. The `CC_POWERLINE_WIDTH` override is an
 * exact escape hatch and keeps its value verbatim; every detected width gets the
 * margin. Never returns below one column.
 */
export function statuslineWidth(overrides: Partial<WidthDeps> = {}): number {
  const env = overrides.env ?? process.env;
  const width = detectTerminalWidth(overrides);
  if (positiveInt(env.CC_POWERLINE_WIDTH)) {
    return width;
  }
  return Math.max(1, width - CLAUDE_CODE_RESERVED_COLUMNS);
}

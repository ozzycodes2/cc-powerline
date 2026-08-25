/**
 * Wiring cc-powerline into Claude Code. `init` writes the `statusLine` hook into
 * Claude Code's own settings.json so the user never has to hand-edit it — the
 * manual step the README used to require.
 *
 * That file belongs to Claude Code, not to us, so the write is deliberately
 * conservative: it merges into the existing object, preserving every other key,
 * and refuses to touch a file it can't parse rather than clobber a real config.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** The command Claude Code runs to render the statusline. */
export const STATUSLINE_COMMAND = 'cc-powerline';

/**
 * Absolute path to Claude Code's user settings.json, honoring the same
 * `CLAUDE_CONFIG_DIR` override Claude Code itself respects.
 */
export function claudeSettingsPath(): string {
  const base = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  return join(base, 'settings.json');
}

export interface WireResult {
  path: string;
  /**
   * `created`: no settings file existed. `updated`: a file existed and we
   * changed its statusLine. `unchanged`: the hook already pointed at us.
   */
  outcome: 'created' | 'updated' | 'unchanged';
  /** The command we replaced, set only when overwriting a different hook. */
  previousCommand?: string;
}

export interface WireDeps {
  path?: string;
  /** Injectable reader; returns file text or `null` if unreadable. */
  readText?: (path: string) => Promise<string | null>;
  writeText?: (path: string, text: string) => Promise<void>;
}

async function defaultReadText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function defaultWriteText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, 'utf8');
}

/** The `command` of an existing statusLine object, if it has one. */
function commandOf(statusLine: unknown): string | undefined {
  if (
    statusLine &&
    typeof statusLine === 'object' &&
    !Array.isArray(statusLine)
  ) {
    const cmd = (statusLine as Record<string, unknown>).command;
    return typeof cmd === 'string' ? cmd : undefined;
  }
  return undefined;
}

/** The manual wiring snippet, shown when auto-wiring is declined or fails. */
export function manualWiringHint(): string {
  return (
    `Add this to ${claudeSettingsPath()}: ` +
    `"statusLine": { "type": "command", "command": "${STATUSLINE_COMMAND}" }`
  );
}

/** A one-line human summary of a completed {@link wireStatusLine}. */
export function describeWireResult(res: WireResult): string {
  if (res.outcome === 'unchanged') {
    return `Claude Code already renders cc-powerline (${res.path}).`;
  }
  if (res.previousCommand !== undefined) {
    return `Wired cc-powerline into Claude Code — replaced "${res.previousCommand}" (${res.path}).`;
  }
  return `Wired cc-powerline into Claude Code (${res.path}).`;
}

/**
 * Whether Claude Code's `statusLine` already runs cc-powerline. A missing,
 * unreadable, or unparseable settings file counts as not wired — the caller
 * should offer to wire it, and {@link wireStatusLine} reports the parse error
 * at write time rather than here.
 */
export async function isStatusLineWired(
  deps: Pick<WireDeps, 'path' | 'readText'> = {},
): Promise<boolean> {
  const path = deps.path ?? claudeSettingsPath();
  const readText = deps.readText ?? defaultReadText;
  const text = await readText(path);
  if (text === null) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return false;
    }
    return (
      commandOf((parsed as Record<string, unknown>).statusLine) ===
      STATUSLINE_COMMAND
    );
  } catch {
    return false;
  }
}

/**
 * Add or update Claude Code's `statusLine` hook so it renders cc-powerline,
 * preserving all other settings. Idempotent: a hook already pointing at us is
 * left untouched. Throws rather than overwrite a settings file that isn't a
 * JSON object — corrupting the user's Claude config is worse than making them
 * wire it by hand.
 */
export async function wireStatusLine(deps: WireDeps = {}): Promise<WireResult> {
  const path = deps.path ?? claudeSettingsPath();
  const readText = deps.readText ?? defaultReadText;
  const writeText = deps.writeText ?? defaultWriteText;

  const text = await readText(path);
  const existed = text !== null;

  let settings: Record<string, unknown> = {};
  if (text !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`${path} is not valid JSON`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${path} is not a JSON object`);
    }
    settings = parsed as Record<string, unknown>;
  }

  const previousCommand = commandOf(settings.statusLine);
  if (previousCommand === STATUSLINE_COMMAND) {
    return { path, outcome: 'unchanged' };
  }

  settings.statusLine = { type: 'command', command: STATUSLINE_COMMAND };
  await writeText(path, `${JSON.stringify(settings, null, 2)}\n`);

  return {
    path,
    outcome: existed ? 'updated' : 'created',
    ...(previousCommand !== undefined ? { previousCommand } : {}),
  };
}

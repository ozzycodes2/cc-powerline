/**
 * Load user settings from `${XDG_CONFIG_HOME:-~/.config}/cc-powerline/
 * settings.json`, falling back to defaults. Reading and parsing are
 * best-effort — a missing or malformed file yields the defaults, never an
 * exception.
 *
 * A one-time load-time warning (not per-render) is emitted when the built-in
 * style is paired with configured right-side widgets, which that style
 * silently ignores.
 */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SettingsSchema, type Settings } from '../types/Settings.js';
import { DEFAULT_SETTINGS } from './defaultSettings.js';

export interface LoadResult {
  settings: Settings;
  warnings: string[];
  source: 'default' | 'file';
}

/** Absolute path to the settings file. */
export function settingsPath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'cc-powerline', 'settings.json');
}

/**
 * Warnings about a settings object. Currently: built-in style + non-empty
 * right groups (which built-in ignores). Pure, so it is unit-testable.
 */
export function settingsWarnings(settings: Settings): string[] {
  const warnings: string[] = [];
  if (settings.style === 'builtin') {
    const hasRight = settings.lines.some((line) => line.right.length > 0);
    if (hasRight) {
      warnings.push(
        "style 'builtin' ignores right-side widgets — move them to 'left' or switch to the 'powerline' style.",
      );
    }
  }
  return warnings;
}

export interface LoadSettingsOptions {
  path?: string;
  /** Injectable reader; returns file text or `null` if unreadable. */
  readText?: (path: string) => Promise<string | null>;
}

async function defaultReadText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

export async function loadSettings(opts: LoadSettingsOptions = {}): Promise<LoadResult> {
  const path = opts.path ?? settingsPath();
  const readText = opts.readText ?? defaultReadText;

  const text = await readText(path);
  if (text === null) {
    return { settings: DEFAULT_SETTINGS, warnings: [], source: 'default' };
  }

  let parsed: Settings;
  try {
    const json: unknown = JSON.parse(text);
    const result = SettingsSchema.safeParse(json);
    parsed = result.success ? result.data : DEFAULT_SETTINGS;
  } catch {
    return { settings: DEFAULT_SETTINGS, warnings: [], source: 'default' };
  }

  // A config that names no lines still gets the default widget layout.
  const settings: Settings =
    parsed.lines.length === 0 ? { ...parsed, lines: DEFAULT_SETTINGS.lines } : parsed;

  return { settings, warnings: settingsWarnings(settings), source: 'file' };
}

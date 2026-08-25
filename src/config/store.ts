/**
 * The config store: the one seam every frontend uses to read and write Settings
 * on disk. It owns the write and the strict (throwing) read, and re-exports the
 * lenient read + path so a frontend imports all its config IO from here. A
 * save-time concern (validation, backup, migration) has a single home to land in.
 *
 * `loadSettings` stays the lenient reader (missing/malformed → defaults, with
 * warnings) the render path also uses; `loadConfigStrict` is its throwing
 * counterpart for explicit user imports.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SettingsSchema, type Settings } from '../types/Settings.js';
import { loadSettings, settingsPath, type LoadResult } from './loadSettings.js';

export { loadSettings, settingsPath };
export type { LoadResult };

/** Persist a config, creating parent dirs. Returns the path written. */
export async function saveConfig(
  settings: Settings,
  path = settingsPath(),
): Promise<string> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  return path;
}

/**
 * Read and validate a config, throwing on a missing file or a schema mismatch —
 * the opposite of {@link loadSettings}, which silently degrades to defaults. Use
 * for an explicit user import where a silent fallback would hide the mistake.
 */
export async function loadConfigStrict(path: string): Promise<Settings> {
  const text = await readFile(path, 'utf8');
  const result = SettingsSchema.safeParse(JSON.parse(text));
  if (!result.success) {
    throw new Error('not a valid settings file');
  }
  return result.data;
}

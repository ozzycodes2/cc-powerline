/** Persist a Settings object to the config path, creating parent dirs. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { settingsPath } from '../config/loadSettings.js';
import type { Settings } from '../types/Settings.js';

export async function writeSettings(settings: Settings, path = settingsPath()): Promise<string> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  return path;
}

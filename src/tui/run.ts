/**
 * `runTui` is the Ink analog of the wizard's `runInit`: a thin IO driver around
 * the pure reducer + components. It loads the existing config so the editor
 * edits in place, mounts <App>, and resolves when the user quits. IO is
 * injectable (load / write / streams) so it can be driven by ink-testing-library.
 */
import { createElement } from 'react';
import { readFile } from 'node:fs/promises';
import { render } from 'ink';
import { App } from './App.js';
import { loadSettings, settingsPath } from '../config/loadSettings.js';
import { writeSettings } from '../cli/writeConfig.js';
import { scanThemes } from './themeScan.js';
import { SettingsSchema, type Settings } from '../types/Settings.js';
import type { Preset } from '../cli/presets.js';

export interface RunTuiDeps {
  load?: () => Promise<{ settings: Settings; sourcePath: string }>;
  save?: (settings: Settings) => Promise<void>;
  loadFrom?: (path: string) => Promise<Settings>;
  /** Palettes for the Theme panel; defaults to scanning the user's prompt config. */
  themes?: Preset[];
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
}

export async function defaultLoad(): Promise<{ settings: Settings; sourcePath: string }> {
  const { settings } = await loadSettings();
  return { settings, sourcePath: settingsPath() };
}

/**
 * Strict importer for the Import/export screen: unlike `loadSettings`, a missing
 * file or invalid schema throws so the editor can show the error rather than
 * silently swapping in defaults.
 */
export async function defaultLoadFrom(path: string): Promise<Settings> {
  const text = await readFile(path, 'utf8');
  const result = SettingsSchema.safeParse(JSON.parse(text));
  if (!result.success) {
    throw new Error('not a valid settings file');
  }
  return result.data;
}

export async function runTui(deps: RunTuiDeps = {}): Promise<void> {
  const load = deps.load ?? defaultLoad;
  const save = deps.save ?? ((s: Settings) => writeSettings(s).then(() => undefined));
  const loadFrom = deps.loadFrom ?? defaultLoadFrom;
  const themes = deps.themes ?? scanThemes();

  const { settings, sourcePath } = await load();
  // Only forward stdin/stdout when injected: Ink defaults them to the real
  // process streams, but an explicit `undefined` key overrides that default
  // and leaves it with no stream to attach its resize listener to.
  const options: Parameters<typeof render>[1] = { exitOnCtrlC: false };
  if (deps.stdin) options.stdin = deps.stdin;
  if (deps.stdout) options.stdout = deps.stdout;
  const app = render(
    createElement(App, { initialSettings: settings, sourcePath, save, loadFrom, themes }),
    options,
  );
  await app.waitUntilExit();
}

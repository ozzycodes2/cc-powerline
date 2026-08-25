/**
 * `runTui` is the Ink analog of the wizard's `runInit`: a thin IO driver around
 * the pure reducer + components. It loads the existing config so the editor
 * edits in place, mounts <App>, and resolves when the user quits. IO is
 * injectable (load / write / streams) so it can be driven by ink-testing-library.
 */
import { createElement } from 'react';
import { render } from 'ink';
import { App } from './App.js';
import {
  loadSettings,
  settingsPath,
  saveConfig,
  loadConfigStrict,
} from '../config/store.js';
import { scanThemes } from './themeScan.js';
import {
  isStatusLineWired,
  wireStatusLine,
  type WireResult,
} from '../config/claudeSettings.js';
import type { Settings } from '../types/Settings.js';
import type { Preset } from '../config/palette.js';

export interface RunTuiDeps {
  load?: () => Promise<{ settings: Settings; sourcePath: string }>;
  save?: (settings: Settings) => Promise<void>;
  loadFrom?: (path: string) => Promise<Settings>;
  /** Palettes for the Theme panel; defaults to scanning the user's prompt config. */
  themes?: Preset[];
  /** Add the statusLine hook to Claude Code's settings; defaults to the real write. */
  wire?: () => Promise<WireResult>;
  /** Whether Claude Code already runs cc-powerline; defaults to the real read. */
  checkWired?: () => Promise<boolean>;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
}

export async function defaultLoad(): Promise<{
  settings: Settings;
  sourcePath: string;
}> {
  const { settings } = await loadSettings();
  return { settings, sourcePath: settingsPath() };
}

/** Strict importer for the Import/export screen — see {@link loadConfigStrict}. */
export async function defaultLoadFrom(path: string): Promise<Settings> {
  return loadConfigStrict(path);
}

export async function runTui(deps: RunTuiDeps = {}): Promise<void> {
  const load = deps.load ?? defaultLoad;
  const save =
    deps.save ?? ((s: Settings) => saveConfig(s).then(() => undefined));
  const loadFrom = deps.loadFrom ?? defaultLoadFrom;
  const themes = deps.themes ?? scanThemes();
  const wire = deps.wire ?? (() => wireStatusLine());
  const checkWired = deps.checkWired ?? (() => isStatusLineWired());

  const { settings, sourcePath } = await load();
  // Only forward stdin/stdout when injected: Ink defaults them to the real
  // process streams, but an explicit `undefined` key overrides that default
  // and leaves it with no stream to attach its resize listener to.
  const options: Parameters<typeof render>[1] = { exitOnCtrlC: false };
  if (deps.stdin) options.stdin = deps.stdin;
  if (deps.stdout) options.stdout = deps.stdout;
  const app = render(
    createElement(App, {
      initialSettings: settings,
      sourcePath,
      save,
      loadFrom,
      themes,
      wire,
      checkWired,
    }),
    options,
  );
  await app.waitUntilExit();
}

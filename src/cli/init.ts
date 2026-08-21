/**
 * `cc-powerline init` — a small interactive wizard that writes a config through
 * the same {@link Settings} schema a hand-edited file uses. The wizard is a
 * friendlier front end for the same config, not a parallel code path.
 *
 * The answer→settings mapping ({@link buildSettingsFromAnswers}) is pure and
 * separately tested; {@link runInit} is the thin IO driver around it.
 */
import { writeSettings } from './writeConfig.js';
import { DEFAULT_PRESET_KEY, PRESETS, presetByKey } from './presets.js';
import { multiSelect, readlineIO, select, type Choice, type PromptIO } from './prompts.js';
import { previewContext } from './previewContext.js';
import { buildStatus } from '../pipeline.js';
import { detectTerminalWidth } from '../render/terminalWidth.js';
import { WIDGET_TYPES } from '../widgets/registry.js';
import type { Settings, WidgetItem } from '../types/Settings.js';

export interface WizardAnswers {
  style: 'powerline' | 'builtin';
  left: string[];
  right: string[];
  preset: string;
}

/** Assign a group's widgets their fg + a round-robin bg from the preset. */
function toItems(types: string[], presetKey: string): WidgetItem[] {
  const preset = presetByKey(presetKey);
  return types.map((type, i) => ({
    type,
    fg: preset.fg,
    bg: preset.bgs[i % preset.bgs.length],
  }));
}

/** Pure: turn wizard answers into a Settings object. */
export function buildSettingsFromAnswers(answers: WizardAnswers): Settings {
  // Built-in style ignores the right group entirely, so never write one.
  const right = answers.style === 'powerline' ? answers.right : [];
  return {
    style: answers.style,
    lines: [
      {
        left: toItems(answers.left, answers.preset),
        right: toItems(right, answers.preset),
      },
    ],
  };
}

const widgetChoices = (defaults: string[]): Choice<string>[] =>
  WIDGET_TYPES.map((type) => ({ label: type, value: type, checked: defaults.includes(type) }));

export interface InitDeps {
  io?: PromptIO;
  writeConfig?: (settings: Settings) => Promise<string>;
  log?: (message: string) => void;
  /** Width for the mock preview; defaults to the detected terminal width. */
  previewWidth?: number;
}

/**
 * Render the chosen settings against fully-populated mock data. Widgets hide
 * only when they have nothing to show, so a live render would drop half the
 * user's picks; the mock feeds every widget so the preview reflects the
 * actual selection.
 */
export function renderPreview(settings: Settings, width: number): string {
  return buildStatus(settings, previewContext(), width);
}

/** Run the interactive wizard, persist the result, and return it. */
export async function runInit(deps: InitDeps = {}): Promise<Settings> {
  const io = deps.io ?? readlineIO();
  const writeConfig = deps.writeConfig ?? ((s: Settings) => writeSettings(s));
  // eslint-disable-next-line no-console
  const log = deps.log ?? ((m: string) => console.log(m));

  try {
    const style = await select<'powerline' | 'builtin'>(io, 'Render style:', [
      { label: 'powerline — anchored segment groups with arrow separators', value: 'powerline' },
      { label: 'builtin — plain single-line (left group only)', value: 'builtin' },
    ]);

    const left = await multiSelect(
      io,
      'Left widgets (in order):',
      widgetChoices(['model', 'git-branch', 'directory']),
    );

    const right =
      style === 'powerline'
        ? await multiSelect(
            io,
            'Right widgets (in order):',
            widgetChoices(['context-length', 'cache-hit-rate', 'session-cost']),
          )
        : [];

    const preset = await select(
      io,
      'Color preset:',
      PRESETS.map((p) => ({ label: p.label, value: p.key })),
      PRESETS.findIndex((p) => p.key === DEFAULT_PRESET_KEY),
    );

    const settings = buildSettingsFromAnswers({ style, left, right, preset });
    const width = deps.previewWidth ?? detectTerminalWidth();
    log('');
    log('Preview (with sample data):');
    log(renderPreview(settings, width));
    log('');
    const path = await writeConfig(settings);
    log(`Wrote settings to ${path}`);
    return settings;
  } finally {
    io.close();
  }
}

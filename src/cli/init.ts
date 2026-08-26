/**
 * `cc-powerline init` — a small interactive wizard that writes a config through
 * the same {@link Settings} schema a hand-edited file uses. The wizard is a
 * friendlier front end for the same config, not a parallel code path.
 *
 * The answer→settings mapping ({@link buildSettingsFromAnswers}) is pure and
 * separately tested; {@link runInit} is the thin IO driver around it.
 */
import { saveConfig } from '../config/store.js';
import { DEFAULT_PRESET_KEY, PRESETS, presetByKey } from './presets.js';
import { applyPalette } from '../config/palette.js';
import {
  multiSelect,
  promptNumber,
  readlineIO,
  select,
  type Choice,
  type PromptIO,
} from './prompts.js';
import { previewContext } from './previewContext.js';
import { buildStatus } from '../pipeline.js';
import { statuslineWidth } from '../render/terminalWidth.js';
import { WIDGET_TYPES } from '../widgets/registry.js';
import type { Settings, WidgetItem } from '../types/Settings.js';

/** One line's picks: widgets on the left group, the right group, or both. */
export interface LineAnswer {
  left: string[];
  right: string[];
}

export interface WizardAnswers {
  style: 'powerline' | 'builtin';
  lines: LineAnswer[];
  preset: string;
}

/** The most lines the wizard offers to configure. */
export const MAX_LINES = 5;

/** Pure: turn wizard answers into a Settings object. */
export function buildSettingsFromAnswers(answers: WizardAnswers): Settings {
  const bare = (types: string[]): WidgetItem[] =>
    types.map((type) => ({ type }));
  const settings: Settings = {
    style: answers.style,
    lines: answers.lines.map((line) => ({
      left: bare(line.left),
      // Built-in style ignores the right group entirely, so never write one.
      right: answers.style === 'powerline' ? bare(line.right) : [],
    })),
  };
  // applyPalette restarts the bg ring per group, so each line leads with the
  // preset's first color regardless of the lines before it.
  return applyPalette(settings, presetByKey(answers.preset));
}

const widgetChoices = (defaults: string[]): Choice<string>[] =>
  WIDGET_TYPES.map((type) => ({
    label: type,
    value: type,
    checked: defaults.includes(type),
  }));

/**
 * Prompt one line's widgets. A powerline line may carry a left group, a right
 * group, or both; the loop only re-asks when a line ends up empty on both
 * sides. A built-in line only has a left group.
 */
async function promptLine(
  io: PromptIO,
  style: WizardAnswers['style'],
  n: number,
): Promise<LineAnswer> {
  if (style === 'builtin') {
    for (;;) {
      const left = await multiSelect(
        io,
        `Line ${n} widgets (in order):`,
        widgetChoices([]),
      );
      if (left.length > 0) {
        return { left, right: [] };
      }
      io.write('  Pick at least one widget for this line.');
    }
  }
  for (;;) {
    const left = await multiSelect(
      io,
      `Line ${n} — left widgets (empty to skip):`,
      widgetChoices([]),
    );
    const right = await multiSelect(
      io,
      `Line ${n} — right widgets (empty to skip):`,
      widgetChoices([]),
    );
    if (left.length === 0 && right.length === 0) {
      io.write('  Pick at least one widget, on the left or the right.');
      continue;
    }
    return { left, right };
  }
}

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
  const writeConfig = deps.writeConfig ?? ((s: Settings) => saveConfig(s));
  const log = deps.log ?? ((m: string) => console.log(m));

  try {
    const style = await select<'powerline' | 'builtin'>(io, 'Render style:', [
      {
        label: 'powerline — anchored segment groups with arrow separators',
        value: 'powerline',
      },
      {
        label: 'builtin — plain single-line (left group only)',
        value: 'builtin',
      },
    ]);

    const count = await promptNumber(io, 'How many lines?', {
      def: 1,
      min: 1,
      max: MAX_LINES,
    });
    const lines: LineAnswer[] = [];
    for (let i = 0; i < count; i += 1) {
      // Prompts are inherently sequential — each waits on the user's answer.
      lines.push(await promptLine(io, style, i + 1));
    }

    const preset = await select(
      io,
      'Color preset:',
      PRESETS.map((p) => ({ label: p.label, value: p.key })),
      PRESETS.findIndex((p) => p.key === DEFAULT_PRESET_KEY),
    );

    const settings = buildSettingsFromAnswers({ style, lines, preset });
    const width = deps.previewWidth ?? statuslineWidth();
    log('');
    log('Preview (with sample data):');
    log(renderPreview(settings, width));
    log('');
    await writeConfig(settings);
    return settings;
  } finally {
    io.close();
  }
}

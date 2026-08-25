/**
 * Discover the user's existing prompt themes and expose each as a color preset.
 * The Theme panel lists these alongside the built-in presets so the status line
 * can adopt the palette of whatever prompt the user already runs. This is the IO
 * half — locating and reading the files; the parsing is pure (`themeParse.ts`).
 *
 * Sources probed (first that exists at each path wins): Powerlevel10k
 * (`~/.p10k.zsh`), oh-my-posh (`$POSH_THEME`), and a classic Powerline
 * colorscheme (`$XDG_CONFIG_HOME/powerline/colorschemes/default.json`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Color } from '../render/types.js';
import type { Preset } from '../cli/presets.js';
import { parseP10k, parsePowerline, parseOhMyPosh } from './themeParse.js';

/** Read a file's text, or null if it is missing/unreadable. */
export type ReadFile = (path: string) => string | null;

export interface ScanOptions {
  home?: string;
  env?: NodeJS.ProcessEnv;
  read?: ReadFile;
}

// A detected theme with fewer than two distinct colors makes no meaningful ring.
const MIN_COLORS = 2;
// Cap the ring so the swatch row stays readable; p10k reuses ~a dozen indices.
const MAX_COLORS = 8;

const defaultRead: ReadFile = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

interface Source {
  key: string;
  label: string;
  path: string | undefined;
  extract: (text: string) => Color[];
}

/**
 * Scan known prompt-theme locations and return one preset per source that
 * yields a usable palette. IO is injectable (home / env / read) so the scan is
 * fully unit-testable without touching a real filesystem.
 */
export function scanThemes(opts: ScanOptions = {}): Preset[] {
  const env = opts.env ?? process.env;
  const home = opts.home ?? env.HOME ?? homedir();
  const read = opts.read ?? defaultRead;
  const configHome = env.XDG_CONFIG_HOME || join(home, '.config');

  const sources: Source[] = [
    { key: 'p10k', label: 'Powerlevel10k (detected)', path: join(home, '.p10k.zsh'), extract: parseP10k },
    {
      key: 'omp',
      label: 'oh-my-posh (detected)',
      path: env.POSH_THEME,
      extract: (t) => parseOhMyPosh(parseJson(t)),
    },
    {
      key: 'powerline',
      label: 'Powerline (detected)',
      path: join(configHome, 'powerline', 'colorschemes', 'default.json'),
      extract: (t) => parsePowerline(parseJson(t)),
    },
  ];

  const presets: Preset[] = [];
  for (const src of sources) {
    if (!src.path) continue;
    const text = read(src.path);
    if (text === null) continue;
    const bgs = src.extract(text).slice(0, MAX_COLORS);
    if (bgs.length < MIN_COLORS) continue;
    presets.push({ key: `detected:${src.key}`, label: src.label, fg: 'brightWhite', bgs });
  }
  return presets;
}

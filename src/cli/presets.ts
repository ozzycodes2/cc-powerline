/**
 * The built-in presets the `init` wizard and the TUI Theme panel offer. A
 * {@link Preset} is a named {@link Palette}; painting a Settings from one lives
 * in `config/palette.ts`, so this module only holds the catalog of choices.
 */
import type { Preset } from '../config/palette.js';

export type { Preset } from '../config/palette.js';

export const PRESETS: Preset[] = [
  {
    key: 'slate',
    label: 'Slate (default) — muted blue-grey',
    fg: 'brightWhite',
    bgs: ['#2d3142', '#4f5d75', '#3d5a80', '#5c6b73', '#6d597a', '#2a9d8f'],
  },
  {
    key: 'mono',
    label: 'Mono — greyscale',
    fg: 'brightWhite',
    bgs: ['#1c1c1c', '#3a3a3a', '#585858', '#767676'],
  },
  {
    key: 'ocean',
    label: 'Ocean — blues and teal',
    fg: 'brightWhite',
    bgs: ['#023047', '#126782', '#219ebc', '#2a9d8f'],
  },
];

export const DEFAULT_PRESET_KEY = 'slate';

/** Look up a preset by key, falling back to the default. */
export function presetByKey(key: string): Preset {
  return PRESETS.find((p) => p.key === key) ?? PRESETS.find((p) => p.key === DEFAULT_PRESET_KEY)!;
}

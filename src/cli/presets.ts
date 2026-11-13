/**
 * The built-in presets the `init` wizard and the TUI Theme panel offer. A
 * {@link Preset} is a named {@link Palette}; painting a Settings from one lives
 * in `config/palette.ts`, so this module only holds the catalog of choices.
 */
import type { Preset } from '../config/palette.js';

export type { Preset } from '../config/palette.js';

export const PRESETS: Preset[] = [
  {
    // fabric-theme v0.2.3 dusk ANSI blue, cyan, green, yellow and magenta. Red
    // is left out: Fabric reserves it for errors.
    key: 'fabric',
    label: 'Fabric (default) — the Fabric ANSI hues',
    fg: 'brightWhite',
    bgs: ['#6f93c0', '#6aaea6', '#8db05a', '#f0b92a', '#c08a9a'],
  },
  {
    // fabric-theme v0.2.3 primary, then the dusk ladder's hairline-strong,
    // ink-subtle and hairline-tertiary, which separate from both a dusk and a
    // dawn terminal ground.
    key: 'fabric-signal',
    label: 'Fabric Signal — orange lead on neutral grays',
    fg: 'brightWhite',
    bgs: ['#ff6a13', '#3b3b41', '#8a8f98', '#45454b'],
  },
  {
    key: 'slate',
    label: 'Slate — muted blue-grey',
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

export const DEFAULT_PRESET_KEY = 'fabric';

/** Look up a preset by key, falling back to the default. */
export function presetByKey(key: string): Preset {
  return (
    PRESETS.find((p) => p.key === key) ??
    PRESETS.find((p) => p.key === DEFAULT_PRESET_KEY)!
  );
}

/**
 * Theme chooser: apply a color palette to recolor every widget at once. A
 * palette is a foreground plus a background ring cycled across each group (see
 * `presets.ts`), so any widget layout gets a coherent look in one keystroke. The
 * list is the built-in presets followed by any themes detected on disk (the
 * user's Powerlevel10k / oh-my-posh / Powerline prompt — see `themeScan.ts`), so
 * the status line can match the prompt they already run. The swatch row previews
 * each palette's background ring. Per-widget tweaks still happen in the color
 * picker; this is the broad-strokes starting point.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Swatch } from './components/Swatch.js';
import { navDirection, moveCursor, isEnter, isBack } from './keymap.js';
import { PRESETS, type Preset } from '../cli/presets.js';
import type { Action, TuiState } from './reducer.js';

export interface ThemePanelProps {
  state: TuiState;
  dispatch: (action: Action) => void;
  /** Palettes detected from the user's prompt config; appended after built-ins. */
  themes?: Preset[];
}

export function ThemePanel({ dispatch, themes = [] }: ThemePanelProps) {
  const palettes: Preset[] = [...PRESETS, ...themes];
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    const dir = navDirection(input, key);
    if (dir === 'up' || dir === 'down') {
      setCursor((c) => moveCursor(c, dir, palettes.length));
    } else if (isEnter(key)) {
      const p = palettes[cursor]!;
      dispatch({ type: 'APPLY_PRESET', fg: p.fg, bgs: p.bgs });
    } else if (isBack(key)) {
      dispatch({ type: 'NAVIGATE', screen: 'menu' });
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Theme</Text>
      <Text dimColor>⏎ recolors every widget with this palette</Text>
      <Box flexDirection="column" marginTop={1}>
        {palettes.map((p, i) => {
          const selected = i === cursor;
          return (
            <Box key={p.key}>
              <Text color={selected ? 'cyan' : undefined}>
                {selected ? '❯ ' : '  '}
              </Text>
              {p.bgs.map((c, ci) => (
                <Swatch key={ci} color={c} cells={1} />
              ))}
              <Text color={selected ? 'cyan' : undefined} bold={selected}>
                {' '}
                {p.label}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

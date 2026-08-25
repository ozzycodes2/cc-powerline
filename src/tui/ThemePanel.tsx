/**
 * Theme chooser: apply a color preset to recolor every widget at once. A preset
 * is a foreground plus a background ring cycled across each group (see
 * `presets.ts`), so any widget layout gets a coherent palette in one keystroke.
 * The swatch row previews each preset's background ring. Per-widget tweaks still
 * happen in the color picker; this is the broad-strokes starting point.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Swatch } from './components/Swatch.js';
import { navDirection, moveCursor, isEnter, isBack } from './keymap.js';
import { PRESETS } from '../cli/presets.js';
import type { Action, TuiState } from './reducer.js';

export interface ThemePanelProps {
  state: TuiState;
  dispatch: (action: Action) => void;
}

export function ThemePanel({ dispatch }: ThemePanelProps) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    const dir = navDirection(input, key);
    if (dir === 'up' || dir === 'down') {
      setCursor((c) => moveCursor(c, dir, PRESETS.length));
    } else if (isEnter(key)) {
      dispatch({ type: 'APPLY_PRESET', presetKey: PRESETS[cursor]!.key });
    } else if (isBack(key)) {
      dispatch({ type: 'NAVIGATE', screen: 'menu' });
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Color preset</Text>
      <Text dimColor>⏎ recolors every widget with this palette</Text>
      <Box flexDirection="column" marginTop={1}>
        {PRESETS.map((p, i) => {
          const selected = i === cursor;
          return (
            <Box key={p.key}>
              <Text color={selected ? 'cyan' : undefined}>{selected ? '❯ ' : '  '}</Text>
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

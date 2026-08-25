/**
 * Style chooser: powerline (arrow-joined segment groups) vs builtin (a plain
 * single line, left group only). Switching is non-destructive in the reducer —
 * right-side widgets are kept, just not rendered by builtin — so toggling back
 * and forth never loses configuration.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SelectList } from './components/SelectList.js';
import { navDirection, moveCursor, isEnter, isBack } from './keymap.js';
import type { Action, TuiState } from './reducer.js';
import type { Settings } from '../types/Settings.js';

export interface StylePanelProps {
  state: TuiState;
  dispatch: (action: Action) => void;
}

const STYLES: { value: Settings['style']; hint: string }[] = [
  { value: 'powerline', hint: 'anchored segment groups with arrow separators' },
  { value: 'builtin', hint: 'plain single line (left group only)' },
];

export function StylePanel({ state, dispatch }: StylePanelProps) {
  const current = STYLES.findIndex((s) => s.value === state.settings.style);
  const [cursor, setCursor] = useState(current < 0 ? 0 : current);

  useInput((input, key) => {
    const dir = navDirection(input, key);
    if (dir === 'up' || dir === 'down') {
      setCursor((c) => moveCursor(c, dir, STYLES.length));
    } else if (isEnter(key)) {
      dispatch({ type: 'SET_STYLE', style: STYLES[cursor]!.value });
    } else if (isBack(key)) {
      dispatch({ type: 'NAVIGATE', screen: 'menu' });
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Render style</Text>
      <SelectList
        items={STYLES.map((s) => ({
          label: s.value === state.settings.style ? `${s.value} ✓` : s.value,
          hint: s.hint,
        }))}
        cursor={cursor}
      />
    </Box>
  );
}

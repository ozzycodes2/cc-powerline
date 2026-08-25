/**
 * The lines overview: one row per status line, showing a compact summary of
 * its left and right widget groups. Enter drills into a line's widgets; `m`
 * enters move mode to reorder whole lines. The focused line is `state.focus.
 * lineIndex`, so drilling in lands the WidgetList on the right line.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SelectList } from './components/SelectList.js';
import { navDirection, moveCursor, isEnter, isBack, isRemove } from './keymap.js';
import type { Action, TuiState } from './reducer.js';
import type { LineConfig } from '../types/Settings.js';

export interface LineListProps {
  state: TuiState;
  dispatch: (action: Action) => void;
}

function summarize(line: LineConfig): string {
  const side = (items: LineConfig['left']) =>
    items.length > 0 ? items.map((w) => w.type).join(', ') : '—';
  return `L: ${side(line.left)}   R: ${side(line.right)}`;
}

export function LineList({ state, dispatch }: LineListProps) {
  const lines = state.settings.lines;
  const cursor = state.focus.lineIndex;
  const [moveMode, setMoveMode] = useState(false);

  useInput((input, key) => {
    const dir = navDirection(input, key);
    if (moveMode) {
      if (dir === 'up') dispatch({ type: 'MOVE_LINE', lineIndex: cursor, dir: -1 });
      else if (dir === 'down') dispatch({ type: 'MOVE_LINE', lineIndex: cursor, dir: 1 });
      else if (isEnter(key) || isBack(key)) setMoveMode(false);
      return;
    }
    if (dir === 'up' || dir === 'down') {
      dispatch({ type: 'NAVIGATE', focus: { lineIndex: moveCursor(cursor, dir, lines.length) } });
    } else if (isEnter(key)) {
      dispatch({ type: 'NAVIGATE', screen: 'widgets', focus: { side: 'left', itemIndex: 0 } });
    } else if (input === 'a') {
      dispatch({ type: 'ADD_LINE' });
    } else if (isRemove(input, key)) {
      dispatch({ type: 'REMOVE_LINE', lineIndex: cursor });
    } else if (input === 'm') {
      setMoveMode(true);
    } else if (isBack(key)) {
      dispatch({ type: 'NAVIGATE', screen: 'menu' });
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>
        Lines {moveMode ? <Text color="yellow">[MOVE — ↑↓ to reorder, ⏎ done]</Text> : null}
      </Text>
      <SelectList
        items={lines.map((line, i) => ({ label: `Line ${i + 1}`, hint: summarize(line) }))}
        cursor={cursor}
      />
    </Box>
  );
}

/**
 * The widget editor for one status line. Shows the left and right groups side
 * by side; `focus.side`/`focus.itemIndex` (from the reducer) drive which widget
 * is highlighted, so the preview and the edit target stay in lockstep.
 *
 * Move mode reorders the focused widget in place (↑↓) or ships it to the other
 * side (Tab / ←→) via the reducer's MOVE_WIDGET / MOVE_WIDGET_ACROSS, which also
 * carry the focus along. Enter opens the color editor for the focused widget.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SelectList } from './components/SelectList.js';
import { navDirection, moveCursor, isEnter, isBack, isRemove } from './keymap.js';
import type { Action, Side, TuiState } from './reducer.js';
import type { WidgetItem } from '../types/Settings.js';

export interface WidgetListProps {
  state: TuiState;
  dispatch: (action: Action) => void;
}

const other = (side: Side): Side => (side === 'left' ? 'right' : 'left');

function Group({ title, items, cursor }: { title: string; items: WidgetItem[]; cursor: number }) {
  return (
    <Box flexDirection="column" marginRight={4}>
      <Text bold>{title}</Text>
      {items.length === 0 ? (
        <Text dimColor>{'  (empty)'}</Text>
      ) : (
        <SelectList items={items.map((w) => ({ label: w.type }))} cursor={cursor} />
      )}
    </Box>
  );
}

export function WidgetList({ state, dispatch }: WidgetListProps) {
  const { lineIndex, side, itemIndex } = state.focus;
  const line = state.settings.lines[lineIndex];
  const group = line ? line[side] : [];
  const [moveMode, setMoveMode] = useState(false);

  useInput((input, key) => {
    const dir = navDirection(input, key);
    if (moveMode) {
      if (dir === 'up') dispatch({ type: 'MOVE_WIDGET', lineIndex, side, itemIndex, dir: -1 });
      else if (dir === 'down') dispatch({ type: 'MOVE_WIDGET', lineIndex, side, itemIndex, dir: 1 });
      else if (dir === 'left' || dir === 'right' || key.tab)
        dispatch({ type: 'MOVE_WIDGET_ACROSS', lineIndex, side, itemIndex });
      else if (isEnter(key) || isBack(key)) setMoveMode(false);
      return;
    }
    if (dir === 'up' || dir === 'down') {
      dispatch({ type: 'NAVIGATE', focus: { itemIndex: moveCursor(itemIndex, dir, group.length) } });
    } else if (dir === 'left' || dir === 'right' || key.tab) {
      dispatch({ type: 'NAVIGATE', focus: { side: other(side) } });
    } else if (isEnter(key)) {
      if (group.length > 0) dispatch({ type: 'NAVIGATE', screen: 'color' });
    } else if (input === 'a') {
      dispatch({ type: 'NAVIGATE', screen: 'picker' });
    } else if (input === 'c') {
      if (group.length > 0) dispatch({ type: 'NAVIGATE', screen: 'color' });
    } else if (isRemove(input, key)) {
      if (group.length > 0) dispatch({ type: 'REMOVE_WIDGET', lineIndex, side, itemIndex });
    } else if (input === 'm') {
      if (group.length > 0) setMoveMode(true);
    } else if (isBack(key)) {
      dispatch({ type: 'NAVIGATE', screen: 'lines' });
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>
        Line {lineIndex + 1} widgets{' '}
        {moveMode ? <Text color="yellow">[MOVE — ↑↓ reorder · tab/←→ across · ⏎ done]</Text> : null}
      </Text>
      <Box marginTop={1}>
        <Group title="left" items={line?.left ?? []} cursor={side === 'left' ? itemIndex : -1} />
        <Group title="right" items={line?.right ?? []} cursor={side === 'right' ? itemIndex : -1} />
      </Box>
    </Box>
  );
}

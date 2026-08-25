/**
 * Fuzzy widget picker. Typing filters the catalog by a subsequence match over
 * each widget's type + label (see `fuzzy.ts`); ↑↓ move through the ranked
 * results, Enter adds the highlighted one at the focused line/side, Esc cancels.
 * Only arrow keys navigate here — letters are query input, so vi-style h/j/k/l
 * would be ambiguous.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SelectList } from './components/SelectList.js';
import { isEnter, isBack } from './keymap.js';
import { WIDGET_CATALOG, choiceSearchText, type WidgetChoice } from './catalog.js';
import { fuzzyFilter } from './fuzzy.js';
import type { Action, TuiState } from './reducer.js';

export interface WidgetPickerProps {
  state: TuiState;
  dispatch: (action: Action) => void;
}

export function WidgetPicker({ state, dispatch }: WidgetPickerProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const { lineIndex, side } = state.focus;

  const results: WidgetChoice[] = fuzzyFilter(query, WIDGET_CATALOG, choiceSearchText);
  // Clamp the cursor as the result set shrinks under a longer query.
  const clamped = results.length === 0 ? 0 : Math.min(cursor, results.length - 1);

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor(clamped > 0 ? clamped - 1 : 0);
    } else if (key.downArrow) {
      setCursor(clamped < results.length - 1 ? clamped + 1 : clamped);
    } else if (isEnter(key)) {
      const choice = results[clamped];
      if (choice) {
        dispatch({ type: 'ADD_WIDGET', lineIndex, side, widgetType: choice.type });
        dispatch({ type: 'NAVIGATE', screen: 'widgets' });
      }
    } else if (isBack(key)) {
      dispatch({ type: 'NAVIGATE', screen: 'widgets' });
    } else if (key.backspace || key.delete) {
      setQuery((q) => q.slice(0, -1));
      setCursor(0);
    } else if (input && !key.ctrl && !key.meta) {
      setQuery((q) => q + input);
      setCursor(0);
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>
        Add widget to line {lineIndex + 1} ({side})
      </Text>
      <Box>
        <Text dimColor>filter: </Text>
        <Text color="cyan">{query || ' '}</Text>
      </Box>
      {results.length === 0 ? (
        <Text dimColor>no matches</Text>
      ) : (
        <SelectList
          items={results.map((c) => ({ label: c.label, hint: c.description }))}
          cursor={clamped}
        />
      )}
    </Box>
  );
}

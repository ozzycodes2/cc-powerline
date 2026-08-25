/**
 * Import / export screen. Offers a reset-to-defaults and a load-from-file; both
 * swap the working config in via REPLACE_SETTINGS, which keeps the on-disk
 * snapshot so the change shows as unsaved until the user writes it (^S) — no
 * surprise overwrites. Reading + validating a file is IO, injected as `loadFrom`
 * so it can be faked in tests and kept out of this pure-ish component.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SelectList } from './components/SelectList.js';
import { navDirection, moveCursor, isEnter, isBack } from './keymap.js';
import { DEFAULT_SETTINGS } from '../config/defaultSettings.js';
import type { Action, TuiState } from './reducer.js';
import type { Settings } from '../types/Settings.js';

export interface ImportExportProps {
  state: TuiState;
  dispatch: (action: Action) => void;
  /** Read + validate a settings file; rejects with a message on failure. */
  loadFrom: (path: string) => Promise<Settings>;
}

const ACTIONS = [
  {
    key: 'reset',
    label: 'Reset to defaults',
    hint: 'the built-in single-line layout',
  },
  {
    key: 'load',
    label: 'Load from file…',
    hint: 'replace with another settings.json',
  },
] as const;

export function ImportExport({ state, dispatch, loadFrom }: ImportExportProps) {
  const [cursor, setCursor] = useState(0);
  const [path, setPath] = useState<string | null>(null);

  const runLoad = (p: string) => {
    void loadFrom(p).then(
      (settings) =>
        dispatch({
          type: 'REPLACE_SETTINGS',
          settings,
          message: `Loaded ${p} (unsaved)`,
        }),
      (err: unknown) =>
        dispatch({
          type: 'SET_MESSAGE',
          text: `Could not load: ${(err as Error).message}`,
        }),
    );
  };

  useInput((input, key) => {
    // Path-entry mode captures typing until Enter (load) or Esc (cancel).
    if (path !== null) {
      if (isEnter(key)) {
        if (path.trim().length > 0) {
          runLoad(path.trim());
          setPath(null);
        }
      } else if (isBack(key)) {
        setPath(null);
      } else if (key.backspace || key.delete) {
        setPath((p) => (p ?? '').slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setPath((p) => (p ?? '') + input);
      }
      return;
    }

    const dir = navDirection(input, key);
    if (dir === 'up' || dir === 'down') {
      setCursor((c) => moveCursor(c, dir, ACTIONS.length));
    } else if (isEnter(key)) {
      if (ACTIONS[cursor]!.key === 'reset') {
        dispatch({
          type: 'REPLACE_SETTINGS',
          settings: DEFAULT_SETTINGS,
          message: 'Reset to defaults (unsaved)',
        });
      } else {
        setPath('');
      }
    } else if (isBack(key)) {
      dispatch({ type: 'NAVIGATE', screen: 'menu' });
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Import / export</Text>
      <Text dimColor>writes to {state.sourcePath} on save</Text>
      {path !== null ? (
        <Box marginTop={1}>
          <Text>path: </Text>
          <Text color="cyan">{path || ' '}</Text>
          <Text dimColor> (⏎ load · esc cancel)</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <SelectList
            items={ACTIONS.map((a) => ({ label: a.label, hint: a.hint }))}
            cursor={cursor}
          />
        </Box>
      )}
    </Box>
  );
}

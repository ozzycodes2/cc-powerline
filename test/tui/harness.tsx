/**
 * A reducer-backed harness so component tests exercise the real state machine:
 * keystrokes go through `useInput` into the component, which dispatches into the
 * shared reducer, and the resulting `state` flows back in. This mirrors how
 * `App` wires them, minus the preview and global keybindings.
 */
import { useReducer, type ReactElement } from 'react';
import { reducer, initialState, type Action, type TuiState } from '../../src/tui/reducer.js';
import type { Settings } from '../../src/types/Settings.js';

export interface HarnessProps {
  settings: Settings;
  /** Renders the component under test from live reducer state. */
  children: (state: TuiState, dispatch: (a: Action) => void) => ReactElement;
  /** Called after every render with the current state, for assertions. */
  onState?: (state: TuiState) => void;
}

export function Harness({ settings, children, onState }: HarnessProps) {
  const [state, dispatch] = useReducer(reducer, initialState(settings, '/tmp/s.json'));
  onState?.(state);
  return children(state, dispatch);
}

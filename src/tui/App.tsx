/**
 * Root of the interactive config editor. Owns the reducer (the pure core lives
 * in `reducer.ts`), the render width, global keybindings (save / quit / help),
 * and screen routing. Everything settings-related flows through `dispatch`; the
 * live preview is derived from `state.settings` on every change.
 */
import { useEffect, useReducer, useState } from 'react';
import { Box, useApp, useInput, useStdout } from 'ink';
import {
  reducer,
  initialState,
  isDirty,
  type Action,
  type TuiState,
} from './reducer.js';
import { PreviewPane } from './PreviewPane.js';
import { MainMenu } from './MainMenu.js';
import { LineList } from './LineList.js';
import { WidgetList } from './WidgetList.js';
import { WidgetPicker } from './WidgetPicker.js';
import { ColorPicker } from './ColorPicker.js';
import { StylePanel } from './StylePanel.js';
import { ThemePanel } from './ThemePanel.js';
import { ImportExport } from './ImportExport.js';
import { StatusBar } from './components/StatusBar.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { isQuit, isSave, isHelp } from './keymap.js';
import { detectTerminalWidth } from '../render/terminalWidth.js';
import type { Settings } from '../types/Settings.js';
import type { Preset } from '../cli/presets.js';

export interface AppProps {
  initialSettings: Settings;
  sourcePath: string;
  /** Persist the config; the editor marks itself clean once it resolves. */
  save: (settings: Settings) => Promise<void>;
  /** Read + validate a config from a path (import); rejects on failure. */
  loadFrom?: (path: string) => Promise<Settings>;
  /** Palettes detected from the user's prompt config, shown in the Theme panel. */
  themes?: Preset[];
  /** Fixed width for tests; defaults to the detected terminal width. */
  width?: number;
}

/** Default importer: rejects (rather than silently defaulting) so errors show. */
const rejectingLoad = (path: string): Promise<Settings> =>
  Promise.reject(new Error(`no importer configured for ${path}`));

export function App({
  initialSettings,
  sourcePath,
  save,
  loadFrom = rejectingLoad,
  themes,
  width,
}: AppProps) {
  const [state, dispatch] = useReducer(
    reducer,
    initialState(initialSettings, sourcePath),
  );
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  // A no-op counter bumped on terminal resize to re-derive `cols` and reflow.
  const [, bumpResize] = useState(0);

  useEffect(() => {
    if (!stdout?.on) return;
    const onResize = () => bumpResize((n) => n + 1);
    stdout.on('resize', onResize);
    return () => {
      stdout.off?.('resize', onResize);
    };
  }, [stdout]);

  const cols = width ?? stdout?.columns ?? detectTerminalWidth();
  const dirty = isDirty(state);

  const doSave = () => {
    void save(state.settings).then(() => dispatch({ type: 'SAVED' }));
  };

  const doQuit = () => {
    if (dirty && !confirmQuit) {
      setConfirmQuit(true);
      dispatch({
        type: 'SET_MESSAGE',
        text: 'Unsaved changes — q again to discard, ^S to save',
      });
      return;
    }
    exit();
  };

  useInput((input, key) => {
    // Help swallows all input: any key dismisses it. Because the overlay
    // replaces the screen body, no screen handler is mounted to also react.
    if (helpVisible) {
      setHelpVisible(false);
      return;
    }
    if (isHelp(input)) {
      setHelpVisible(true);
    } else if (isSave(input, key)) {
      setConfirmQuit(false);
      doSave();
    } else if (isQuit(input, key)) {
      doQuit();
    } else if (confirmQuit) {
      // Any other key cancels a pending quit confirmation.
      setConfirmQuit(false);
      dispatch({ type: 'SET_MESSAGE', text: null });
    }
  });

  return (
    <Box flexDirection="column">
      <PreviewPane settings={state.settings} width={cols} />
      <Box marginTop={1}>
        {helpVisible ? (
          <HelpOverlay />
        ) : (
          renderScreen(state, dispatch, doSave, doQuit, loadFrom, themes)
        )}
      </Box>
      <StatusBar
        screen={state.screen}
        dirty={dirty}
        message={state.message}
        sourcePath={sourcePath}
      />
    </Box>
  );
}

function renderScreen(
  state: TuiState,
  dispatch: (a: Action) => void,
  onSave: () => void,
  onQuit: () => void,
  loadFrom: (path: string) => Promise<Settings>,
  themes?: Preset[],
) {
  switch (state.screen) {
    case 'menu':
      return <MainMenu dispatch={dispatch} onSave={onSave} onQuit={onQuit} />;
    case 'lines':
      return <LineList state={state} dispatch={dispatch} />;
    case 'widgets':
      return <WidgetList state={state} dispatch={dispatch} />;
    case 'picker':
      return <WidgetPicker state={state} dispatch={dispatch} />;
    case 'color':
      return <ColorPicker state={state} dispatch={dispatch} />;
    case 'style':
      return <StylePanel state={state} dispatch={dispatch} />;
    case 'theme':
      return <ThemePanel state={state} dispatch={dispatch} themes={themes} />;
    case 'io':
      return (
        <ImportExport state={state} dispatch={dispatch} loadFrom={loadFrom} />
      );
  }
}

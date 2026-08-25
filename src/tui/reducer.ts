/**
 * The pure core of the interactive config editor. Every edit the TUI can make
 * is expressed as an `(state, action) => state` transition here, with no React
 * and no IO — the direct successor to the wizard's pure `buildSettingsFromAnswers`.
 * The Ink components are a thin driver that dispatch these actions and render
 * `state`; all the logic worth testing lives in this file.
 *
 * `focus` is the single source of truth for which line / side / widget the user
 * is on, so the preview and the edit target can never drift apart. Component
 * cursors that don't touch settings (e.g. which menu row) stay local to the
 * component.
 */
import type { Settings } from '../types/Settings.js';
import type { Color } from '../render/types.js';
import {
  addLine,
  addWidget,
  applyPalette,
  clamp,
  moveLine,
  moveWidget,
  moveWidgetAcross,
  removeLine,
  removeWidget,
  setWidgetColor,
  setWidgetOption,
  type Side,
} from '../config/edit.js';

export type { Side };

/** Which editor screen is showing. Unimplemented screens render a placeholder. */
export type Screen =
  'menu' | 'lines' | 'widgets' | 'picker' | 'color' | 'style' | 'theme' | 'io';

export interface Focus {
  lineIndex: number;
  side: Side;
  itemIndex: number;
}

export interface TuiState {
  /** The working config being edited. */
  settings: Settings;
  /** Last-persisted snapshot, for dirty tracking. */
  saved: Settings;
  screen: Screen;
  focus: Focus;
  /** Path the config was loaded from / will be written to. */
  sourcePath: string;
  /** Transient status-bar text (e.g. "Saved"), or null. */
  message: string | null;
}

export type ThemeKey =
  'separator' | 'rightSeparator' | 'defaultFg' | 'defaultBg';

export type Action =
  | { type: 'LOAD'; settings: Settings; sourcePath: string }
  | { type: 'SAVED' }
  | { type: 'NAVIGATE'; screen?: Screen; focus?: Partial<Focus> }
  | { type: 'SET_MESSAGE'; text: string | null }
  | { type: 'SET_STYLE'; style: Settings['style'] }
  | { type: 'SET_SEPARATOR'; value: string | undefined }
  | { type: 'SET_THEME'; key: ThemeKey; value: string | undefined }
  | {
      type: 'ADD_WIDGET';
      lineIndex: number;
      side: Side;
      widgetType: string;
      at?: number;
    }
  | { type: 'REMOVE_WIDGET'; lineIndex: number; side: Side; itemIndex: number }
  | {
      type: 'MOVE_WIDGET';
      lineIndex: number;
      side: Side;
      itemIndex: number;
      dir: -1 | 1;
    }
  | {
      type: 'MOVE_WIDGET_ACROSS';
      lineIndex: number;
      side: Side;
      itemIndex: number;
    }
  | {
      type: 'SET_WIDGET_COLOR';
      lineIndex: number;
      side: Side;
      itemIndex: number;
      channel: 'fg' | 'bg';
      color: Color | undefined;
    }
  | {
      type: 'SET_WIDGET_OPTION';
      lineIndex: number;
      side: Side;
      itemIndex: number;
      key: string;
      value: unknown;
    }
  | { type: 'ADD_LINE' }
  | { type: 'REMOVE_LINE'; lineIndex: number }
  | { type: 'MOVE_LINE'; lineIndex: number; dir: -1 | 1 }
  /** Recolor every widget from a palette. The caller resolves the palette (a
   *  built-in preset or a theme detected on disk), so the reducer stays free of
   *  the preset registry and treats detected themes and built-ins identically. */
  | { type: 'APPLY_PRESET'; fg: Color; bgs: Color[] }
  /** Swap in a whole config (reset to defaults / import a file). Keeps `saved`
   *  so the swap shows as unsaved until the user writes it. */
  | { type: 'REPLACE_SETTINGS'; settings: Settings; message?: string };

/** True when the working config differs from what's on disk. */
export function isDirty(state: TuiState): boolean {
  return JSON.stringify(state.settings) !== JSON.stringify(state.saved);
}

/** Fold a settings edit back into state, keeping `focus` in range. */
function commit(state: TuiState, settings: Settings): TuiState {
  const focus = clampFocus(settings, state.focus);
  return { ...state, settings, focus };
}

/** Keep `focus` pointing at a real line/item after the config shrinks. */
export function clampFocus(settings: Settings, focus: Focus): Focus {
  const lineCount = settings.lines.length;
  if (lineCount === 0) {
    return { lineIndex: 0, side: focus.side, itemIndex: 0 };
  }
  const lineIndex = clamp(focus.lineIndex, 0, lineCount - 1);
  const group = settings.lines[lineIndex]![focus.side];
  const itemIndex =
    group.length === 0 ? 0 : clamp(focus.itemIndex, 0, group.length - 1);
  return { lineIndex, side: focus.side, itemIndex };
}

export function reducer(state: TuiState, action: Action): TuiState {
  switch (action.type) {
    case 'LOAD':
      return {
        ...state,
        settings: action.settings,
        saved: action.settings,
        sourcePath: action.sourcePath,
        focus: clampFocus(action.settings, state.focus),
        message: null,
      };

    case 'SAVED':
      return { ...state, saved: state.settings, message: 'Saved' };

    case 'NAVIGATE':
      return {
        ...state,
        screen: action.screen ?? state.screen,
        focus: action.focus
          ? clampFocus(state.settings, { ...state.focus, ...action.focus })
          : state.focus,
        message: null,
      };

    case 'SET_MESSAGE':
      return { ...state, message: action.text };

    case 'SET_STYLE':
      // Non-destructive: switching to 'builtin' keeps any right-side widgets in
      // the config (they just don't render), so toggling back to 'powerline'
      // restores them. `settingsWarnings` surfaces the ignored groups.
      return commit(state, { ...state.settings, style: action.style });

    case 'SET_SEPARATOR':
      return commit(state, { ...state.settings, separator: action.value });

    case 'SET_THEME': {
      const theme = {
        ...(state.settings.theme ?? {}),
        [action.key]: action.value,
      };
      return commit(state, { ...state.settings, theme });
    }

    case 'ADD_WIDGET':
      return commit(
        state,
        addWidget(
          state.settings,
          action.lineIndex,
          action.side,
          action.widgetType,
          action.at,
        ),
      );

    case 'REMOVE_WIDGET':
      return commit(
        state,
        removeWidget(
          state.settings,
          action.lineIndex,
          action.side,
          action.itemIndex,
        ),
      );

    case 'MOVE_WIDGET': {
      const settings = moveWidget(
        state.settings,
        action.lineIndex,
        action.side,
        action.itemIndex,
        action.dir,
      );
      // Follow the widget with the focus so a run of moves keeps grabbing it.
      const line = state.settings.lines[action.lineIndex];
      const to = action.itemIndex + action.dir;
      const moved =
        line &&
        line[action.side][action.itemIndex] &&
        to >= 0 &&
        to < line[action.side].length;
      return commit(
        moved ? { ...state, focus: { ...state.focus, itemIndex: to } } : state,
        settings,
      );
    }

    case 'MOVE_WIDGET_ACROSS': {
      const other: Side = action.side === 'left' ? 'right' : 'left';
      const settings = moveWidgetAcross(
        state.settings,
        action.lineIndex,
        action.side,
        action.itemIndex,
      );
      const dest = state.settings.lines[action.lineIndex]?.[other].length ?? 0;
      return commit(
        { ...state, focus: { ...state.focus, side: other, itemIndex: dest } },
        settings,
      );
    }

    case 'SET_WIDGET_COLOR':
      return commit(
        state,
        setWidgetColor(
          state.settings,
          action.lineIndex,
          action.side,
          action.itemIndex,
          action.channel,
          action.color,
        ),
      );

    case 'SET_WIDGET_OPTION':
      return commit(
        state,
        setWidgetOption(
          state.settings,
          action.lineIndex,
          action.side,
          action.itemIndex,
          action.key,
          action.value,
        ),
      );

    case 'ADD_LINE': {
      const settings = addLine(state.settings);
      return commit(
        {
          ...state,
          focus: {
            ...state.focus,
            lineIndex: settings.lines.length - 1,
            itemIndex: 0,
          },
        },
        settings,
      );
    }

    case 'REMOVE_LINE':
      return commit(state, removeLine(state.settings, action.lineIndex));

    case 'MOVE_LINE': {
      const to = action.lineIndex + action.dir;
      const settings = moveLine(state.settings, action.lineIndex, action.dir);
      const moved = settings !== state.settings;
      return commit(
        moved ? { ...state, focus: { ...state.focus, lineIndex: to } } : state,
        settings,
      );
    }

    case 'APPLY_PRESET':
      return commit(
        state,
        applyPalette(state.settings, { fg: action.fg, bgs: action.bgs }),
      );

    case 'REPLACE_SETTINGS':
      return {
        ...commit(state, action.settings),
        message: action.message ?? null,
      };

    default:
      return state;
  }
}

/** Build the initial state around a freshly-loaded config. */
export function initialState(settings: Settings, sourcePath: string): TuiState {
  return {
    settings,
    saved: settings,
    screen: 'menu',
    focus: { lineIndex: 0, side: 'left', itemIndex: 0 },
    sourcePath,
    message: null,
  };
}

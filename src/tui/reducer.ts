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
import type { Settings, WidgetItem, LineConfig } from '../types/Settings.js';
import type { Color } from '../render/types.js';

export type Side = 'left' | 'right';

/** Which editor screen is showing. Unimplemented screens render a placeholder. */
export type Screen = 'menu' | 'lines' | 'widgets' | 'picker' | 'color' | 'style' | 'theme' | 'io';

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

export type ThemeKey = 'separator' | 'rightSeparator' | 'defaultFg' | 'defaultBg';

export type Action =
  | { type: 'LOAD'; settings: Settings; sourcePath: string }
  | { type: 'SAVED' }
  | { type: 'NAVIGATE'; screen?: Screen; focus?: Partial<Focus> }
  | { type: 'SET_MESSAGE'; text: string | null }
  | { type: 'SET_STYLE'; style: Settings['style'] }
  | { type: 'SET_SEPARATOR'; value: string | undefined }
  | { type: 'SET_THEME'; key: ThemeKey; value: string | undefined }
  | { type: 'ADD_WIDGET'; lineIndex: number; side: Side; widgetType: string; at?: number }
  | { type: 'REMOVE_WIDGET'; lineIndex: number; side: Side; itemIndex: number }
  | { type: 'MOVE_WIDGET'; lineIndex: number; side: Side; itemIndex: number; dir: -1 | 1 }
  | { type: 'MOVE_WIDGET_ACROSS'; lineIndex: number; side: Side; itemIndex: number }
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

/** An empty line placeholder used when adding a fresh line. */
const EMPTY_LINE: LineConfig = { left: [], right: [] };

/** True when the working config differs from what's on disk. */
export function isDirty(state: TuiState): boolean {
  return JSON.stringify(state.settings) !== JSON.stringify(state.saved);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Replace one line immutably; out-of-range indices are a no-op. */
function withLine(
  settings: Settings,
  lineIndex: number,
  update: (line: LineConfig) => LineConfig,
): Settings {
  const line = settings.lines[lineIndex];
  if (!line) {
    return settings;
  }
  const lines = settings.lines.slice();
  lines[lineIndex] = update(line);
  return { ...settings, lines };
}

/** Replace one widget item immutably; out-of-range indices are a no-op. */
function withItem(
  settings: Settings,
  lineIndex: number,
  side: Side,
  itemIndex: number,
  update: (item: WidgetItem) => WidgetItem,
): Settings {
  return withLine(settings, lineIndex, (line) => {
    const group = line[side];
    if (!group[itemIndex]) {
      return line;
    }
    const next = group.slice();
    next[itemIndex] = update(next[itemIndex]!);
    return { ...line, [side]: next };
  });
}

/** Assign the palette's fg to every item and a round-robin bg per group. */
function applyPreset(settings: Settings, fg: Color, bgs: Color[]): Settings {
  const paint = (group: WidgetItem[]): WidgetItem[] =>
    group.map((item, i) => ({ ...item, fg, bg: bgs[i % bgs.length] }));
  return {
    ...settings,
    lines: settings.lines.map((line) => ({
      ...line,
      left: paint(line.left),
      right: paint(line.right),
    })),
  };
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
  const itemIndex = group.length === 0 ? 0 : clamp(focus.itemIndex, 0, group.length - 1);
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
      const theme = { ...(state.settings.theme ?? {}), [action.key]: action.value };
      return commit(state, { ...state.settings, theme });
    }

    case 'ADD_WIDGET':
      return commit(
        state,
        withLine(state.settings, action.lineIndex, (line) => {
          const group = line[action.side].slice();
          const at = action.at ?? group.length;
          group.splice(clamp(at, 0, group.length), 0, { type: action.widgetType });
          return { ...line, [action.side]: group };
        }),
      );

    case 'REMOVE_WIDGET':
      return commit(
        state,
        withLine(state.settings, action.lineIndex, (line) => {
          const group = line[action.side].slice();
          if (!group[action.itemIndex]) {
            return line;
          }
          group.splice(action.itemIndex, 1);
          return { ...line, [action.side]: group };
        }),
      );

    case 'MOVE_WIDGET': {
      const settings = withLine(state.settings, action.lineIndex, (line) => {
        const group = line[action.side].slice();
        const to = action.itemIndex + action.dir;
        if (!group[action.itemIndex] || to < 0 || to >= group.length) {
          return line;
        }
        [group[action.itemIndex], group[to]] = [group[to]!, group[action.itemIndex]!];
        return { ...line, [action.side]: group };
      });
      // Follow the widget with the focus so a run of moves keeps grabbing it.
      const line = state.settings.lines[action.lineIndex];
      const to = action.itemIndex + action.dir;
      const moved =
        line && line[action.side][action.itemIndex] && to >= 0 && to < line[action.side].length;
      return commit(
        moved ? { ...state, focus: { ...state.focus, itemIndex: to } } : state,
        settings,
      );
    }

    case 'MOVE_WIDGET_ACROSS': {
      const other: Side = action.side === 'left' ? 'right' : 'left';
      const settings = withLine(state.settings, action.lineIndex, (line) => {
        const from = line[action.side].slice();
        const item = from[action.itemIndex];
        if (!item) {
          return line;
        }
        from.splice(action.itemIndex, 1);
        return { ...line, [action.side]: from, [other]: [...line[other], item] };
      });
      const dest = state.settings.lines[action.lineIndex]?.[other].length ?? 0;
      return commit({ ...state, focus: { ...state.focus, side: other, itemIndex: dest } }, settings);
    }

    case 'SET_WIDGET_COLOR':
      return commit(
        state,
        withItem(state.settings, action.lineIndex, action.side, action.itemIndex, (item) => {
          const next = { ...item };
          if (action.color === undefined) {
            delete next[action.channel];
          } else {
            next[action.channel] = action.color;
          }
          return next;
        }),
      );

    case 'SET_WIDGET_OPTION':
      return commit(
        state,
        withItem(state.settings, action.lineIndex, action.side, action.itemIndex, (item) => ({
          ...item,
          options: { ...(item.options ?? {}), [action.key]: action.value },
        })),
      );

    case 'ADD_LINE': {
      const lines = [...state.settings.lines, { ...EMPTY_LINE }];
      return commit(
        { ...state, focus: { ...state.focus, lineIndex: lines.length - 1, itemIndex: 0 } },
        { ...state.settings, lines },
      );
    }

    case 'REMOVE_LINE': {
      if (state.settings.lines.length <= 1 || !state.settings.lines[action.lineIndex]) {
        return state; // keep at least one line
      }
      const lines = state.settings.lines.slice();
      lines.splice(action.lineIndex, 1);
      return commit(state, { ...state.settings, lines });
    }

    case 'MOVE_LINE': {
      const to = action.lineIndex + action.dir;
      if (!state.settings.lines[action.lineIndex] || to < 0 || to >= state.settings.lines.length) {
        return state;
      }
      const lines = state.settings.lines.slice();
      [lines[action.lineIndex], lines[to]] = [lines[to]!, lines[action.lineIndex]!];
      return commit({ ...state, focus: { ...state.focus, lineIndex: to } }, { ...state.settings, lines });
    }

    case 'APPLY_PRESET':
      return commit(state, applyPreset(state.settings, action.fg, action.bgs));

    case 'REPLACE_SETTINGS':
      return { ...commit(state, action.settings), message: action.message ?? null };

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

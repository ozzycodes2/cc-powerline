/**
 * The editor's home screen: a menu that routes into each editing surface and
 * offers save / quit. It owns only its own cursor row (not a settings concern),
 * dispatching NAVIGATE to change screens and delegating save/quit to the App.
 */
import { useState } from 'react';
import { useInput } from 'ink';
import { SelectList } from './components/SelectList.js';
import { navDirection, moveCursor, isEnter } from './keymap.js';
import type { Action, Screen } from './reducer.js';

interface MenuEntry {
  label: string;
  hint: string;
  run: () => void;
}

export interface MainMenuProps {
  dispatch: (action: Action) => void;
  onSave: () => void;
  onQuit: () => void;
}

export function MainMenu({ dispatch, onSave, onQuit }: MainMenuProps) {
  const go = (screen: Screen) => () => dispatch({ type: 'NAVIGATE', screen });
  const entries: MenuEntry[] = [
    { label: 'Lines & widgets', hint: 'add, remove, reorder', run: go('lines') },
    { label: 'Style', hint: 'powerline / builtin', run: go('style') },
    { label: 'Theme', hint: 'recolor from a preset or a detected prompt theme', run: go('theme') },
    { label: 'Import / export', hint: 'presets, reset, load', run: go('io') },
    { label: 'Save', hint: 'write settings.json', run: onSave },
    { label: 'Quit', hint: '', run: onQuit },
  ];

  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    const dir = navDirection(input, key);
    if (dir === 'up' || dir === 'down') {
      setCursor((c) => moveCursor(c, dir, entries.length));
    } else if (isEnter(key)) {
      entries[cursor]?.run();
    }
  });

  return <SelectList items={entries.map((e) => ({ label: e.label, hint: e.hint }))} cursor={cursor} />;
}

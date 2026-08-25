/**
 * Post-save prompt to wire cc-powerline into Claude Code's settings.json. This
 * lives inside the TUI on purpose: a readline prompt after Ink exits collides
 * with the terminal teardown and renders broken, so the confirmation is a
 * regular screen that returns to the menu once answered.
 *
 * The actual write (and its "preserve other keys / never clobber" rules) is
 * {@link wireStatusLine}, injected as `wire` so this component stays IO-free and
 * testable; it only turns a yes/no into a call plus a status message.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SelectList } from './components/SelectList.js';
import { isEnter, isBack, navDirection, moveCursor } from './keymap.js';
import {
  describeWireResult,
  manualWiringHint,
  type WireResult,
} from '../config/claudeSettings.js';
import type { Action } from './reducer.js';

export interface WirePanelProps {
  dispatch: (action: Action) => void;
  /** Perform the wiring; rejects if the settings file can't be parsed. */
  wire: () => Promise<WireResult>;
}

const CHOICES: { label: string; hint: string; yes: boolean }[] = [
  { label: 'Yes', hint: 'add the statusLine hook now', yes: true },
  { label: 'No', hint: 'skip — wire it manually later', yes: false },
];

export function WirePanel({ dispatch, wire }: WirePanelProps) {
  const [cursor, setCursor] = useState(0);

  // Both answers return to the menu; NAVIGATE clears the message, so the
  // outcome is set right after it.
  const back = (message: string) => {
    dispatch({ type: 'NAVIGATE', screen: 'menu' });
    dispatch({ type: 'SET_MESSAGE', text: message });
  };

  const answer = (yes: boolean): void => {
    if (!yes) {
      back(`Skipped — ${manualWiringHint()}`);
      return;
    }
    void wire().then(
      (res) => back(describeWireResult(res)),
      (err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        back(`Could not wire Claude Code: ${reason}. ${manualWiringHint()}`);
      },
    );
  };

  useInput((input, key) => {
    const dir = navDirection(input, key);
    if (dir) {
      setCursor((c) => moveCursor(c, dir, CHOICES.length));
    } else if (input === 'y' || input === 'Y') {
      answer(true);
    } else if (input === 'n' || input === 'N' || isBack(key)) {
      answer(false);
    } else if (isEnter(key)) {
      answer(CHOICES[cursor]!.yes);
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Wire cc-powerline into Claude Code?</Text>
      <Text dimColor>
        Adds the statusLine hook to Claude Code&apos;s settings.json, keeping
        your other settings.
      </Text>
      <Box marginTop={1}>
        <SelectList
          items={CHOICES.map((c) => ({ label: c.label, hint: c.hint }))}
          cursor={cursor}
        />
      </Box>
    </Box>
  );
}

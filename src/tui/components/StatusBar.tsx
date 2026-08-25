/**
 * Bottom bar: a dirty/saved indicator, any transient message, and the
 * keybinding hints for the current screen. Hints live next to `keymap` intent
 * so the footer stays honest about what the keys actually do.
 */
import { Box, Text } from 'ink';
import type { Screen } from '../reducer.js';

const HINTS: Record<Screen, string> = {
  menu: '↑↓ move · ⏎ open · ^S save · ? help · q quit',
  lines: '↑↓ move · ⏎ edit · a add · d del · m move · esc back',
  widgets:
    '↑↓ move · ⏎ edit · a add · d del · c color · m move · tab side · esc back',
  picker: 'type to filter · ↑↓ move · ⏎ pick · esc cancel',
  color: '↑↓←→ swatch · h hex · ⏎ pick · esc cancel',
  style: '↑↓ move · ⏎ toggle · esc back',
  theme: '↑↓ move · ⏎ edit · esc back',
  io: '↑↓ move · ⏎ choose · esc back',
  wire: 'y wire · n skip · ↑↓ move · ⏎ choose',
};

export interface StatusBarProps {
  screen: Screen;
  dirty: boolean;
  message: string | null;
  sourcePath: string;
}

export function StatusBar({
  screen,
  dirty,
  message,
  sourcePath,
}: StatusBarProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        {dirty ? (
          <Text color="yellow">● unsaved</Text>
        ) : (
          <Text color="green">✓ saved</Text>
        )}
        <Text dimColor> · {sourcePath}</Text>
        {message ? <Text color="cyan"> · {message}</Text> : null}
      </Box>
      <Text dimColor>{HINTS[screen]}</Text>
    </Box>
  );
}

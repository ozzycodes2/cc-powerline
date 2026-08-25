/**
 * A full keybinding cheat-sheet, shown over the editor when `?` is pressed.
 * It is intentionally input-less: the App swaps it in for the screen body (so
 * no screen handler is mounted) and any keypress dismisses it. Grouped by the
 * surface the keys belong to so it mirrors how the StatusBar hints read.
 */
import { Box, Text } from 'ink';

const SECTIONS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Global',
    keys: [
      ['^S', 'save to disk'],
      ['q / ^C', 'quit (confirms if unsaved)'],
      ['?', 'toggle this help'],
      ['esc', 'back / cancel'],
    ],
  },
  {
    title: 'Lists',
    keys: [
      ['↑↓ / k j', 'move'],
      ['⏎', 'open / edit'],
      ['a', 'add'],
      ['d / del', 'remove'],
      ['m', 'move mode'],
    ],
  },
  {
    title: 'Widgets & color',
    keys: [
      ['tab / ←→', 'switch side (move mode: across)'],
      ['c / ⏎', 'edit color'],
      ['h', 'hex entry (color)'],
    ],
  },
  {
    title: 'Picker',
    keys: [
      ['type', 'fuzzy filter'],
      ['↑↓', 'move results'],
      ['⏎', 'pick'],
    ],
  },
];

export function HelpOverlay() {
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Keyboard help</Text>
      {SECTIONS.map((section) => (
        <Box key={section.title} flexDirection="column" marginTop={1}>
          <Text bold color="cyan">
            {section.title}
          </Text>
          {section.keys.map(([k, desc]) => (
            <Box key={k}>
              <Box width={16}>
                <Text color="yellow">{k}</Text>
              </Box>
              <Text dimColor>{desc}</Text>
            </Box>
          ))}
        </Box>
      ))}
      <Text dimColor>{'\n'}press any key to close</Text>
    </Box>
  );
}

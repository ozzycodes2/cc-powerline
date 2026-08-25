/**
 * A controlled vertical menu: the parent owns the cursor and input handling,
 * this just paints the rows and marks the one at `cursor`. Replaces the
 * numbered-choice `select` from the readline wizard.
 */
import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface SelectItem {
  /** Row text. Need not be unique — widget types can repeat within a group. */
  label: string;
  /** Optional dim text shown to the right of the label. */
  hint?: string;
  /** Optional custom row body; overrides `label`/`hint` rendering. */
  render?: (selected: boolean) => ReactNode;
}

export interface SelectListProps {
  items: SelectItem[];
  cursor: number;
}

export function SelectList({ items, cursor }: SelectListProps) {
  return (
    <Box flexDirection="column">
      {items.map((item, i) => {
        const selected = i === cursor;
        return (
          <Box key={i}>
            <Text color={selected ? 'cyan' : undefined}>{selected ? '❯ ' : '  '}</Text>
            {item.render ? (
              item.render(selected)
            ) : (
              <Text color={selected ? 'cyan' : undefined} bold={selected}>
                {item.label}
                {item.hint ? <Text dimColor> {item.hint}</Text> : null}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

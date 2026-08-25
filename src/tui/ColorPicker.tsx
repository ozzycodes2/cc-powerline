/**
 * Per-widget color editor. Edits the focused widget's `fg`/`bg` (from
 * `state.focus`) through the reducer's SET_WIDGET_COLOR, so the live preview
 * updates the instant a color is picked. Tab flips between the two channels;
 * the swatch grid offers "inherit" (clears the override, falling back to the
 * line/theme cascade) plus every named color; `h` opens a `#rrggbb` entry for
 * truecolor. Applying keeps the screen open so fg and bg can be set in one trip.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Swatch } from './components/Swatch.js';
import { navDirection, gridMove, isEnter, isBack } from './keymap.js';
import { NAMED_COLORS } from '../render/colors.js';
import type { Action, Side, TuiState } from './reducer.js';
import type { Color } from '../render/types.js';

export interface ColorPickerProps {
  state: TuiState;
  dispatch: (action: Action) => void;
}

type Channel = 'fg' | 'bg';
const COLS = 4;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** "inherit" (clear the override) followed by every named color. */
const ENTRIES: { label: string; color: Color | undefined }[] = [
  { label: 'inherit', color: undefined },
  ...NAMED_COLORS.map((c) => ({ label: c, color: c as Color })),
];

function currentItem(state: TuiState) {
  const { lineIndex, side, itemIndex } = state.focus;
  return state.settings.lines[lineIndex]?.[side as Side][itemIndex];
}

export function ColorPicker({ state, dispatch }: ColorPickerProps) {
  const { lineIndex, side, itemIndex } = state.focus;
  const item = currentItem(state);
  const [channel, setChannel] = useState<Channel>('fg');
  const [cursor, setCursor] = useState(0);
  const [hex, setHex] = useState<string | null>(null);

  const apply = (color: Color | undefined) =>
    dispatch({
      type: 'SET_WIDGET_COLOR',
      lineIndex,
      side,
      itemIndex,
      channel,
      color,
    });

  useInput((input, key) => {
    // Hex-entry mode captures typing until Enter (apply) or Esc (cancel).
    if (hex !== null) {
      if (isEnter(key)) {
        if (HEX_RE.test(hex)) {
          apply(hex as Color);
          setHex(null);
        } else {
          dispatch({ type: 'SET_MESSAGE', text: 'Enter a #rrggbb hex color' });
        }
      } else if (isBack(key)) {
        setHex(null);
      } else if (key.backspace || key.delete) {
        setHex((h) => (h && h.length > 1 ? h.slice(0, -1) : '#'));
      } else if (/^[0-9a-fA-F]$/.test(input) && hex.length < 7) {
        setHex((h) => (h ?? '#') + input);
      }
      return;
    }

    // `h` opens hex entry here; it wins over the vi-left binding navDirection
    // would otherwise give it (arrow-left still moves the cursor).
    if (input === 'h') {
      const cur = channel === 'fg' ? item?.fg : item?.bg;
      setHex(typeof cur === 'string' && cur.startsWith('#') ? cur : '#');
      return;
    }
    const dir = navDirection(input, key);
    if (dir) {
      setCursor((c) => gridMove(c, dir, ENTRIES.length, COLS));
    } else if (key.tab) {
      setChannel((c) => (c === 'fg' ? 'bg' : 'fg'));
    } else if (isEnter(key)) {
      apply(ENTRIES[cursor]!.color);
    } else if (isBack(key)) {
      dispatch({ type: 'NAVIGATE', screen: 'widgets' });
    }
  });

  if (!item) {
    return <Text dimColor>No widget selected — press esc to go back.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold>Color · {item.type}</Text>
      <Box marginTop={1}>
        <ChannelLabel
          active={channel === 'fg'}
          name="fg"
          color={item.fg as Color | undefined}
        />
        <Text> </Text>
        <ChannelLabel
          active={channel === 'bg'}
          name="bg"
          color={item.bg as Color | undefined}
        />
        <Text dimColor> (tab to switch)</Text>
      </Box>

      {hex !== null ? (
        <Box marginTop={1}>
          <Text>hex: </Text>
          <Text color="cyan">{hex}</Text>
          <Text dimColor> (type 6 digits · ⏎ apply · esc cancel)</Text>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          {rows(ENTRIES, COLS).map((row, r) => (
            <Box key={r}>
              {row.map((e, c) => {
                const idx = r * COLS + c;
                const selected = idx === cursor;
                return (
                  <Box key={e.label} marginRight={2}>
                    <Text color={selected ? 'cyan' : undefined}>
                      {selected ? '❯' : ' '}
                    </Text>
                    <Swatch color={e.color} />
                    <Text color={selected ? 'cyan' : undefined}>
                      {' '}
                      {e.label}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function ChannelLabel({
  active,
  name,
  color,
}: {
  active: boolean;
  name: string;
  color: Color | undefined;
}) {
  return (
    <Box>
      <Text bold={active} color={active ? 'cyan' : undefined}>
        {active ? '▶ ' : '  '}
        {name}:{' '}
      </Text>
      <Swatch color={color} />
      <Text dimColor> {color ?? 'inherit'}</Text>
    </Box>
  );
}

/** Chunk a flat list into rows of `cols` for grid layout. */
function rows<T>(items: T[], cols: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    out.push(items.slice(i, i + cols));
  }
  return out;
}

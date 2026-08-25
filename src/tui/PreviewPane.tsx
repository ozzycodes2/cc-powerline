/**
 * The always-visible live preview. Given the working settings it runs the same
 * production render pipeline the statusline uses (`buildStatus` over the shared
 * all-widgets mock), so what the user sees here is exactly what Claude Code
 * will show. The raw SGR is dropped straight into <Text>, but first run through
 * `expandSgr`: Ink's text layout tracks styles per attribute and only sees the
 * first attribute of our packed fg+bg escapes, so without expansion it never
 * closes the background and the last segment's color bleeds down the screen.
 */
import { Box, Text } from 'ink';
import { useMemo } from 'react';
import type { Settings } from '../types/Settings.js';
import { buildStatus } from '../pipeline.js';
import { previewContext } from '../cli/previewContext.js';
import { expandSgr } from '../render/sgr.js';

export interface PreviewPaneProps {
  settings: Settings;
  width: number;
}

// The framing eats columns the status line can't use: 1 for each border edge
// plus paddingX={1} each side. Rendering to the full width overflows the box and
// Ink wraps the line, bleeding the trailing segment's background onto the next
// visual row — so render to the interior width instead.
const CHROME = 4;

export function PreviewPane({ settings, width }: PreviewPaneProps) {
  const inner = Math.max(1, width - CHROME);
  const lines = useMemo(
    // expandSgr un-packs our compound fg+bg escapes so Ink can close the
    // background; without it the last segment's bg bleeds down the screen.
    () => expandSgr(buildStatus(settings, previewContext(), inner)).split('\n'),
    [settings, inner],
  );
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text dimColor>live preview (sample data)</Text>
      {lines.map((line, i) => (
        // Preview lines have no stable key of their own; index is fine and stable.
        <Text key={i}>{line.length > 0 ? line : ' '}</Text>
      ))}
    </Box>
  );
}

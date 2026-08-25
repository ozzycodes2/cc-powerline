/**
 * The whole live-preview design rests on one assumption: Ink's <Text> passes
 * the raw SGR escape codes we embed in a string through untouched, rather than
 * stripping or re-encoding them. `buildStatus` returns a string already full of
 * 24-bit truecolor sequences (`\x1b[48;2;r;g;bm...`); the preview pane just
 * drops that string into a <Text>. This test locks that guarantee in so a
 * future Ink upgrade that breaks it fails loudly here instead of silently
 * washing the preview grey.
 */
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { createElement } from 'react';
import { buildStatus } from '../../src/pipeline.js';
import { previewContext } from '../../src/cli/previewContext.js';
import { buildSettingsFromAnswers } from '../../src/cli/init.js';
import { DEFAULT_PRESET_KEY } from '../../src/cli/presets.js';
import { stripAnsi } from '../../src/render/stripAnsi.js';

describe('Ink <Text> ANSI passthrough (live-preview spike)', () => {
  const settings = buildSettingsFromAnswers({
    style: 'powerline',
    lines: [{ left: ['model', 'git-branch'], right: ['session-cost'] }],
    preset: DEFAULT_PRESET_KEY,
  });
  const preview = buildStatus(settings, previewContext(), 80);

  it('emits truecolor SGR that survives rendering through <Text>', () => {
    const { lastFrame } = render(createElement(Text, null, preview));
    const frame = lastFrame() ?? '';
    // The default preset uses hex backgrounds, so a 24-bit bg sequence must
    // still be present in the frame Ink produced.
    expect(frame).toContain('48;2;');
    // And the visible glyphs must match what buildStatus rendered.
    expect(stripAnsi(frame)).toContain(stripAnsi(preview));
  });
});

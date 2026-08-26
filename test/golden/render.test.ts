/**
 * Golden snapshot tests: a fixed status fixture rendered through both styles
 * at a fixed width, compared byte-for-byte (ANSI included) against committed
 * .snap.txt files. Catches accidental formatting/color regressions that a
 * behavioral assertion would miss. Regenerate intentionally with
 * `vitest -u` after a deliberate rendering change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildStatus } from '../../src/pipeline.js';
import { parseStatusJSON } from '../../src/types/StatusJSON.js';
import { DEFAULT_SETTINGS } from '../../src/config/defaultSettings.js';
import { ZERO_TOTALS } from '../../src/transcript/parseTranscript.js';
import type { Settings } from '../../src/types/Settings.js';
import type { WidgetContext } from '../../src/widgets/Widget.js';

const fixture = readFileSync(
  fileURLToPath(new URL('../fixtures/statusline-basic.json', import.meta.url)),
  'utf8',
);

const WIDTH = 80;

// Deterministic totals so cost/cache widgets never depend on live pricing.
const ctx: WidgetContext = {
  status: parseStatusJSON(fixture),
  totals: {
    ...ZERO_TOTALS,
    costUsd: 1.2345,
    cacheReadTokens: 9000,
    cacheCreationTokens: 1000,
    contextTokens: 84000,
  },
  git: { branch: 'main' },
};

const BUILTIN: Settings = {
  style: 'builtin',
  lines: [
    {
      left: [
        { type: 'model' },
        {
          type: 'git-branch',
          options: { icon: '', mainIcon: '', worktreeIcon: '' },
        },
        { type: 'directory' },
        { type: 'context-length' },
        { type: 'session-cost' },
      ],
      right: [],
    },
  ],
};

describe('golden render', () => {
  it('powerline (default settings) at width 80', async () => {
    const out = buildStatus(DEFAULT_SETTINGS, ctx, WIDTH);
    await expect(out).toMatchFileSnapshot('./powerline-80.snap.txt');
  });

  it('builtin at width 80', async () => {
    const out = buildStatus(BUILTIN, ctx, WIDTH);
    await expect(out).toMatchFileSnapshot('./builtin-80.snap.txt');
  });

  it('powerline is stable across renders (deterministic)', () => {
    expect(buildStatus(DEFAULT_SETTINGS, ctx, WIDTH)).toBe(
      buildStatus(DEFAULT_SETTINGS, ctx, WIDTH),
    );
  });
});

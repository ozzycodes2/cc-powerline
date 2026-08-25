import { describe, it, expect } from 'vitest';
import {
  loadSettings,
  settingsWarnings,
} from '../../src/config/loadSettings.js';
import { DEFAULT_SETTINGS } from '../../src/config/defaultSettings.js';
import type { Settings } from '../../src/types/Settings.js';

const read = (text: string | null) => async () => text;

describe('settingsWarnings', () => {
  it('warns when builtin style has right-side widgets', () => {
    const s: Settings = {
      style: 'builtin',
      lines: [{ left: [], right: [{ type: 'model' }] }],
    };
    expect(settingsWarnings(s)).toHaveLength(1);
    expect(settingsWarnings(s)[0]).toContain('builtin');
  });

  it('is silent for builtin with only left widgets', () => {
    const s: Settings = {
      style: 'builtin',
      lines: [{ left: [{ type: 'model' }], right: [] }],
    };
    expect(settingsWarnings(s)).toEqual([]);
  });

  it('is silent for powerline with right widgets', () => {
    const s: Settings = {
      style: 'powerline',
      lines: [{ left: [], right: [{ type: 'model' }] }],
    };
    expect(settingsWarnings(s)).toEqual([]);
  });
});

describe('loadSettings', () => {
  it('returns defaults when the file is missing', async () => {
    const res = await loadSettings({ path: '/x', readText: read(null) });
    expect(res.source).toBe('default');
    expect(res.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults on malformed JSON', async () => {
    const res = await loadSettings({
      path: '/x',
      readText: read('{ not json'),
    });
    expect(res.source).toBe('default');
  });

  it('parses a valid file and carries warnings', async () => {
    const file = JSON.stringify({
      style: 'builtin',
      lines: [{ left: [], right: [{ type: 'model' }] }],
    });
    const res = await loadSettings({ path: '/x', readText: read(file) });
    expect(res.source).toBe('file');
    expect(res.settings.style).toBe('builtin');
    expect(res.warnings).toHaveLength(1);
  });

  it('falls back to default lines when the config omits them', async () => {
    const res = await loadSettings({
      path: '/x',
      readText: read(JSON.stringify({ style: 'builtin' })),
    });
    expect(res.settings.lines).toEqual(DEFAULT_SETTINGS.lines);
  });
});

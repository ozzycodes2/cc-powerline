import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSettings, settingsPath } from '../../src/config/loadSettings.js';
import { DEFAULT_SETTINGS } from '../../src/config/defaultSettings.js';

const created: string[] = [];
afterEach(async () => {
  await Promise.all(created.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('settingsPath', () => {
  it('honors XDG_CONFIG_HOME', () => {
    const prev = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = '/tmp/cfg';
    try {
      expect(settingsPath()).toBe('/tmp/cfg/cc-powerline/settings.json');
    } finally {
      if (prev === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = prev;
    }
  });
});

describe('loadSettings with the default (real) reader', () => {
  it('reads and parses an actual settings file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ccpl-cfg-'));
    created.push(dir);
    const path = join(dir, 'settings.json');
    await writeFile(path, JSON.stringify({ style: 'powerline', lines: [{ left: [{ type: 'model' }], right: [] }] }), 'utf8');

    const res = await loadSettings({ path });
    expect(res.source).toBe('file');
    expect(res.settings.style).toBe('powerline');
  });

  it('falls back to defaults when the real file is absent', async () => {
    const res = await loadSettings({ path: join(tmpdir(), 'ccpl-nope-xyz', 'settings.json') });
    expect(res.source).toBe('default');
    expect(res.settings).toEqual(DEFAULT_SETTINGS);
  });
});

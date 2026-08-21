import { describe, it, expect, afterEach } from 'vitest';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeSettings } from '../../src/cli/writeConfig.js';
import { DEFAULT_SETTINGS } from '../../src/config/defaultSettings.js';

const created: string[] = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('writeSettings', () => {
  it('creates missing parent directories and writes pretty JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ccpl-'));
    created.push(dir);
    const path = join(dir, 'nested', 'settings.json');

    const returned = await writeSettings(DEFAULT_SETTINGS, path);
    expect(returned).toBe(path);

    const text = await readFile(path, 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text)).toEqual(DEFAULT_SETTINGS);
  });
});

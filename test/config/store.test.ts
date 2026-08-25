import { describe, it, expect, afterEach } from 'vitest';
import { readFile, rm, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveConfig, loadConfigStrict } from '../../src/config/store.js';
import { DEFAULT_SETTINGS } from '../../src/config/defaultSettings.js';

const created: string[] = [];

afterEach(async () => {
  await Promise.all(
    created.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});

async function tmp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ccpl-'));
  created.push(dir);
  return dir;
}

describe('saveConfig', () => {
  it('creates missing parent directories and writes pretty JSON', async () => {
    const path = join(await tmp(), 'nested', 'settings.json');

    const returned = await saveConfig(DEFAULT_SETTINGS, path);
    expect(returned).toBe(path);

    const text = await readFile(path, 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('loadConfigStrict', () => {
  it('reads and validates a settings file', async () => {
    const path = join(await tmp(), 'ok.json');
    await writeFile(path, JSON.stringify(DEFAULT_SETTINGS), 'utf8');
    expect(await loadConfigStrict(path)).toEqual(DEFAULT_SETTINGS);
  });

  it('throws on a schema-invalid file', async () => {
    const path = join(await tmp(), 'bad.json');
    await writeFile(path, JSON.stringify({ style: 'nonsense' }), 'utf8');
    await expect(loadConfigStrict(path)).rejects.toThrow(
      'not a valid settings file',
    );
  });

  it('rejects when the file does not exist', async () => {
    await expect(loadConfigStrict('/no/such/file.json')).rejects.toBeTruthy();
  });
});

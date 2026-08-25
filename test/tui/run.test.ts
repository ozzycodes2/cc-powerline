/**
 * run.ts is the IO driver: it wires the pure reducer/components to real config
 * IO and mounts Ink. We stub Ink's `render` so no TTY is needed, then check the
 * wiring (deps default sensibly, load feeds <App>) and exercise the two importer
 * helpers against the filesystem.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const renderMock = vi.fn((..._args: unknown[]) => ({ waitUntilExit: () => Promise.resolve() }));
vi.mock('ink', () => ({ render: renderMock }));

const loadSettingsMock = vi.fn();
vi.mock('../../src/config/loadSettings.js', () => ({
  loadSettings: loadSettingsMock,
  settingsPath: () => '/tmp/settings.json',
}));

const { runTui, defaultLoad, defaultLoadFrom } = await import('../../src/tui/run.js');

const SAMPLE = { style: 'powerline', lines: [{ left: [{ type: 'model' }], right: [] }] };

beforeEach(() => {
  renderMock.mockClear();
  loadSettingsMock.mockReset();
});

describe('runTui', () => {
  it('loads via the injected loader and mounts <App> with those settings', async () => {
    const load = vi.fn().mockResolvedValue({ settings: SAMPLE, sourcePath: '/somewhere.json' });
    await runTui({ load, stdin: undefined, stdout: undefined });
    expect(load).toHaveBeenCalledOnce();
    const [element] = renderMock.mock.calls[0]!;
    expect((element as { props: { initialSettings: unknown; sourcePath: string } }).props)
      .toMatchObject({ initialSettings: SAMPLE, sourcePath: '/somewhere.json' });
  });

  it('omits stdin/stdout entirely when not injected, so Ink keeps its defaults', async () => {
    const load = vi.fn().mockResolvedValue({ settings: SAMPLE, sourcePath: '/x.json' });
    await runTui({ load });
    const options = renderMock.mock.calls[0]![1] as Record<string, unknown>;
    // An explicit `stdout: undefined` would clobber Ink's process.stdout default.
    expect('stdout' in options).toBe(false);
    expect('stdin' in options).toBe(false);
  });

  it('falls back to defaultLoad (loadSettings) when none is injected', async () => {
    loadSettingsMock.mockResolvedValue({ settings: SAMPLE });
    await runTui({});
    expect(loadSettingsMock).toHaveBeenCalledOnce();
    const [element] = renderMock.mock.calls[0]!;
    expect((element as { props: { sourcePath: string } }).props.sourcePath).toBe('/tmp/settings.json');
  });
});

describe('defaultLoad', () => {
  it('pairs loaded settings with the resolved settings path', async () => {
    loadSettingsMock.mockResolvedValue({ settings: SAMPLE });
    expect(await defaultLoad()).toEqual({ settings: SAMPLE, sourcePath: '/tmp/settings.json' });
  });
});

describe('defaultLoadFrom', () => {
  it('reads and validates a settings file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ccp-'));
    const p = join(dir, 'ok.json');
    await writeFile(p, JSON.stringify(SAMPLE), 'utf8');
    expect(await defaultLoadFrom(p)).toEqual(SAMPLE);
  });

  it('throws on a schema-invalid file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ccp-'));
    const p = join(dir, 'bad.json');
    await writeFile(p, JSON.stringify({ style: 'nonsense' }), 'utf8');
    await expect(defaultLoadFrom(p)).rejects.toThrow('not a valid settings file');
  });

  it('rejects when the file does not exist', async () => {
    await expect(defaultLoadFrom('/no/such/file.json')).rejects.toBeTruthy();
  });
});

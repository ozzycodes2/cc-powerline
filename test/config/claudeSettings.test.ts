import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  claudeSettingsPath,
  wireStatusLine,
  STATUSLINE_COMMAND,
  type WireDeps,
} from '../../src/config/claudeSettings.js';

const created: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    created.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});

async function tmp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ccpl-claude-'));
  created.push(dir);
  return dir;
}

/** A capturing in-memory file: seeds `read`, records the last `write`. */
function memFile(initial: string | null): {
  deps: WireDeps;
  written: () => string | null;
} {
  let stored = initial;
  const deps: WireDeps = {
    path: '/fake/.claude/settings.json',
    readText: async () => stored,
    writeText: async (_p, text) => {
      stored = text;
    },
  };
  return { deps, written: () => stored };
}

describe('claudeSettingsPath', () => {
  it('defaults under ~/.claude', () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', '');
    expect(claudeSettingsPath()).toMatch(/[/\\]\.claude[/\\]settings\.json$/);
  });

  it('honors CLAUDE_CONFIG_DIR', () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', '/custom/cc');
    expect(claudeSettingsPath()).toBe('/custom/cc/settings.json');
  });
});

describe('wireStatusLine', () => {
  it('creates the file when none exists', async () => {
    const { deps, written } = memFile(null);
    const res = await wireStatusLine(deps);

    expect(res.outcome).toBe('created');
    expect(res.previousCommand).toBeUndefined();
    expect(res.path).toBe('/fake/.claude/settings.json');
    const out = JSON.parse(written()!);
    expect(out.statusLine).toEqual({
      type: 'command',
      command: STATUSLINE_COMMAND,
    });
    expect(written()!.endsWith('\n')).toBe(true);
  });

  it('adds the hook while preserving other keys', async () => {
    const { deps, written } = memFile(
      JSON.stringify({ theme: 'dark', permissions: { allow: ['x'] } }),
    );
    const res = await wireStatusLine(deps);

    expect(res.outcome).toBe('updated');
    const out = JSON.parse(written()!);
    expect(out.theme).toBe('dark');
    expect(out.permissions).toEqual({ allow: ['x'] });
    expect(out.statusLine.command).toBe(STATUSLINE_COMMAND);
  });

  it('overwrites a different statusLine and reports the old command', async () => {
    const { deps, written } = memFile(
      JSON.stringify({ statusLine: { type: 'command', command: 'other-line' } }),
    );
    const res = await wireStatusLine(deps);

    expect(res.outcome).toBe('updated');
    expect(res.previousCommand).toBe('other-line');
    expect(JSON.parse(written()!).statusLine.command).toBe(STATUSLINE_COMMAND);
  });

  it('is a no-op when the hook already points at us', async () => {
    const original = JSON.stringify({
      statusLine: { type: 'command', command: STATUSLINE_COMMAND, padding: 0 },
    });
    let wrote = false;
    const res = await wireStatusLine({
      path: '/fake/settings.json',
      readText: async () => original,
      writeText: async () => {
        wrote = true;
      },
    });

    expect(res.outcome).toBe('unchanged');
    expect(wrote).toBe(false);
  });

  it('reads and writes the real file, creating parent dirs', async () => {
    // Exercises the default fs-backed IO, not the injected stubs.
    const path = join(await tmp(), 'nested', 'settings.json');

    const created = await wireStatusLine({ path });
    expect(created.outcome).toBe('created');
    const first = JSON.parse(await readFile(path, 'utf8'));
    expect(first.statusLine.command).toBe(STATUSLINE_COMMAND);

    // Re-running against the now-existing file is a read hit + no-op.
    const again = await wireStatusLine({ path });
    expect(again.outcome).toBe('unchanged');

    await writeFile(
      path,
      JSON.stringify({ statusLine: { type: 'command', command: 'old' } }),
      'utf8',
    );
    const replaced = await wireStatusLine({ path });
    expect(replaced.outcome).toBe('updated');
    expect(replaced.previousCommand).toBe('old');
  });

  it('refuses to overwrite a malformed (non-JSON) file', async () => {
    const { deps } = memFile('{ not json');
    await expect(wireStatusLine(deps)).rejects.toThrow('not valid JSON');
  });

  it('refuses to overwrite a JSON value that is not an object', async () => {
    const { deps } = memFile(JSON.stringify([1, 2, 3]));
    await expect(wireStatusLine(deps)).rejects.toThrow('not a JSON object');
  });
});

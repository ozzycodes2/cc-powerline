import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildProgram } from '../src/cli.js';
import { settingsPath } from '../src/config/loadSettings.js';

afterEach(() => vi.restoreAllMocks());

describe('buildProgram', () => {
  it('registers the expected top-level commands', () => {
    const names = buildProgram()
      .commands.map((c) => c.name())
      .sort();
    expect(names).toEqual(['config', 'init', 'pricing']);
  });

  it('exposes config and pricing subcommands', () => {
    const program = buildProgram();
    const sub = (name: string) =>
      program.commands
        .find((c) => c.name() === name)!
        .commands.map((c) => c.name())
        .sort();
    expect(sub('config')).toEqual(['path']);
    expect(sub('pricing')).toEqual(['refresh', 'show']);
  });

  it('`config path` prints the resolved settings path', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await buildProgram().parseAsync(['node', 'cc-powerline', 'config', 'path']);
    expect(log).toHaveBeenCalledWith(settingsPath());
  });
});

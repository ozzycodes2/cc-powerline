import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildProgram } from '../src/cli.js';
import { settingsPath } from '../src/config/loadSettings.js';
import { stripAnsi } from '../src/render/stripAnsi.js';

afterEach(() => vi.restoreAllMocks());

describe('buildProgram', () => {
  it('registers the expected top-level commands', () => {
    const names = buildProgram()
      .commands.map((c) => c.name())
      .sort();
    expect(names).toEqual(['config', 'init', 'preview', 'pricing']);
  });

  it('exposes config and pricing subcommands', () => {
    const program = buildProgram();
    const sub = (name: string) =>
      program.commands
        .find((c) => c.name() === name)!
        .commands.map((c) => c.name())
        .sort();
    expect(sub('config')).toEqual(['edit', 'path']);
    expect(sub('pricing')).toEqual(['refresh', 'show']);
  });

  it('`config path` prints the resolved settings path', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await buildProgram().parseAsync(['node', 'cc-powerline', 'config', 'path']);
    expect(log).toHaveBeenCalledWith(settingsPath());
  });
});

describe('preview command', () => {
  const runPreview = async (...args: string[]): Promise<string> => {
    let out = '';
    vi.spyOn(console, 'log').mockImplementation((m?: unknown) => {
      out += String(m);
    });
    await buildProgram().parseAsync(['node', 'cc-powerline', 'preview', ...args]);
    return stripAnsi(out);
  };

  it('renders every widget over mock data (powerline default)', async () => {
    const out = await runPreview('--width', '200');
    // One assertion per widget type so a dropped widget is obvious.
    expect(out).toContain('Opus 4.8'); // model
    expect(out).toContain('high'); // model-effort
    expect(out).toContain('main'); // git-branch
    expect(out).toContain('+12 -3'); // git-changes
    expect(out).toContain('~/D/w/voice-connect'); // directory
    expect(out).toContain('42%'); // context-length
    expect(out).toContain('$1.23'); // session-cost
    expect(out).toContain('4¢→53¢'); // next-cost (warm→cold projection)
    expect(out).toContain('\u{f1c0} 90%'); // cache-hit-rate (icon + value)
    expect(out).toContain('4:43'); // cache-window
    expect(out).toContain('5h:18%'); // rate-limit
    expect(out).toContain('|'); // separator
  });

  it('honors --style builtin (no arrow separators, still all widgets)', async () => {
    const out = await runPreview('--style', 'builtin', '--width', '200');
    expect(out).toContain('Opus 4.8');
    expect(out).toContain('\u{f1c0} 90%');
    expect(out).toContain('5h:18%');
  });
});

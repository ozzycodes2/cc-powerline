import { describe, it, expect, vi, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { buildProgram, main } from '../src/cli.js';
import { settingsPath } from '../src/config/loadSettings.js';
import { stripAnsi } from '../src/render/stripAnsi.js';

const pkgVersion = (
  JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { version: string }
).version;

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
    await buildProgram().parseAsync([
      'node',
      'cc-powerline',
      'preview',
      ...args,
    ]);
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

describe('version', () => {
  it('reports the package.json version, not a hardcoded string', async () => {
    const program = buildProgram().exitOverride();
    let out = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => {
      out += String(c);
      return true;
    });
    // exitOverride makes --version throw instead of calling process.exit.
    await expect(
      program.parseAsync(['node', 'cc-powerline', '--version']),
    ).rejects.toThrow();
    expect(out.trim()).toBe(pkgVersion);
  });
});

describe('main dispatch', () => {
  const origStdin = Object.getOwnPropertyDescriptor(process, 'stdin')!;
  afterEach(() => Object.defineProperty(process, 'stdin', origStdin));

  function feedStdin(text: string, isTTY: boolean): void {
    const stream = Readable.from([Buffer.from(text, 'utf8')]) as Readable & {
      isTTY?: boolean;
    };
    stream.isTTY = isTTY;
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      value: stream,
    });
  }

  const captureStdout = (): { out: () => string } => {
    let out = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => {
      out += String(c);
      return true;
    });
    return { out: () => out };
  };

  it('renders the statusline for no subcommand + piped stdin', async () => {
    feedStdin(JSON.stringify({ model: { display_name: 'Opus 4.8' } }), false);
    const cap = captureStdout();
    await main(['node', 'cc-powerline']);
    expect(stripAnsi(cap.out())).toContain('Opus 4.8');
  });

  it('prints help (never blocks on stdin) for a bare interactive invocation', async () => {
    feedStdin('', true);
    const cap = captureStdout();
    await main(['node', 'cc-powerline']);
    expect(cap.out()).toContain('Usage:');
    expect(cap.out()).toContain('init');
  });

  it('routes an explicit subcommand through commander', async () => {
    feedStdin('', false);
    let out = '';
    vi.spyOn(console, 'log').mockImplementation((m?: unknown) => {
      out += String(m);
    });
    await main(['node', 'cc-powerline', 'preview', '--width', '200']);
    expect(stripAnsi(out)).toContain('Opus 4.8');
  });
});

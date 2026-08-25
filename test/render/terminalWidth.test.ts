import { describe, it, expect } from 'vitest';
import {
  detectTerminalWidth,
  parseSttySize,
  ttyToDevice,
  DEFAULT_WIDTH,
  type WidthDeps,
} from '../../src/render/terminalWidth.js';

function baseDeps(over: Partial<WidthDeps>): Partial<WidthDeps> {
  return {
    env: {},
    stdoutColumns: undefined,
    platform: 'darwin',
    pid: 100,
    exec: () => null,
    ...over,
  };
}

describe('parseSttySize', () => {
  it('extracts the column count from "rows cols"', () => {
    expect(parseSttySize('24 120')).toBe(120);
  });
  it('rejects malformed or non-positive output', () => {
    expect(parseSttySize('nonsense')).toBeNull();
    expect(parseSttySize('24 0')).toBeNull();
    expect(parseSttySize(null)).toBeNull();
  });
});

describe('ttyToDevice', () => {
  it('maps a bare tty name to a /dev path', () => {
    expect(ttyToDevice('ttys001')).toBe('/dev/ttys001');
  });
  it('passes through an absolute /dev path', () => {
    expect(ttyToDevice('/dev/pts/3')).toBe('/dev/pts/3');
  });
  it('returns null when there is no controlling TTY', () => {
    expect(ttyToDevice('?')).toBeNull();
    expect(ttyToDevice('??')).toBeNull();
    expect(ttyToDevice('')).toBeNull();
    expect(ttyToDevice(null)).toBeNull();
  });
});

describe('detectTerminalWidth', () => {
  it('honors the CC_POWERLINE_WIDTH override first', () => {
    expect(
      detectTerminalWidth(baseDeps({ env: { CC_POWERLINE_WIDTH: '133' } })),
    ).toBe(133);
  });

  it('uses a real stdout TTY width when present', () => {
    expect(detectTerminalWidth(baseDeps({ stdoutColumns: 95 }))).toBe(95);
  });

  it('returns the default on Windows without probing', () => {
    expect(detectTerminalWidth(baseDeps({ platform: 'win32' }))).toBe(
      DEFAULT_WIDTH,
    );
  });

  it('walks ancestors and reads width from the first TTY-owning process', () => {
    const exec = (cmd: string): string | null => {
      if (cmd === 'ps -o tty= -p 100') return '?'; // self: piped, no tty
      if (cmd === 'ps -o ppid= -p 100') return '42';
      if (cmd === 'ps -o tty= -p 42') return 'ttys004'; // ancestor owns a tty
      if (cmd === 'stty -f /dev/ttys004 size') return '50 200';
      return null;
    };
    expect(detectTerminalWidth(baseDeps({ platform: 'darwin', exec }))).toBe(
      200,
    );
  });

  it('uses the linux -F stty flag', () => {
    const exec = (cmd: string): string | null => {
      if (cmd === 'ps -o tty= -p 100') return 'pts/1';
      if (cmd === 'stty -F /dev/pts/1 size') return '40 160';
      return null;
    };
    expect(detectTerminalWidth(baseDeps({ platform: 'linux', exec }))).toBe(
      160,
    );
  });

  it('falls back to tput cols when no ancestor TTY is found', () => {
    const exec = (cmd: string): string | null => {
      if (cmd === 'tput cols') return '77';
      return null; // every ps/stty probe fails
    };
    expect(detectTerminalWidth(baseDeps({ exec }))).toBe(77);
  });

  it('falls back to the fixed default when everything fails', () => {
    expect(detectTerminalWidth(baseDeps({ exec: () => null }))).toBe(
      DEFAULT_WIDTH,
    );
  });
});

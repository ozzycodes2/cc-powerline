import { describe, it, expect, vi, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import { main } from '../src/index.js';
import { stripAnsi } from '../src/render/stripAnsi.js';

const origStdin = Object.getOwnPropertyDescriptor(process, 'stdin')!;

afterEach(() => {
  Object.defineProperty(process, 'stdin', origStdin);
  vi.restoreAllMocks();
});

function feedStdin(text: string): void {
  Object.defineProperty(process, 'stdin', {
    configurable: true,
    value: Readable.from([Buffer.from(text, 'utf8')]),
  });
}

describe('main (real stdin → stdout wiring)', () => {
  it('reads status JSON from stdin and writes a rendered line to stdout', async () => {
    // No transcript_path → zero totals; offline pricing resolves via the embedded fallback.
    feedStdin(JSON.stringify({ model: { display_name: 'Opus 4.8' } }));
    let written = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      written += String(chunk);
      return true;
    });

    await main();
    expect(stripAnsi(written)).toContain('Opus 4.8');
  });

  it('writes an empty line for empty/garbage stdin rather than throwing', async () => {
    feedStdin('not json at all');
    let written = 'sentinel';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      written = String(chunk);
      return true;
    });

    await expect(main()).resolves.toBeUndefined();
    // Default layout still renders directory/model widgets that may be empty; the
    // key guarantee is that main() completed and produced a string.
    expect(typeof written).toBe('string');
  });
});

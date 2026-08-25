import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMainEntry } from '../src/isMainEntry.js';

// The bug this guards: npm exposes the CLI through a bin symlink named
// `cc-powerline`, so `process.argv[1]` is the symlink path and never ends in
// `cli.js`. A naive `endsWith('cli.js')` check skips `main()` and every command
// silently no-ops. Resolving both sides through realpath must see through it.
describe('isMainEntry', () => {
  let dir: string;
  let moduleFile: string;
  let moduleUrl: string;
  let binSymlink: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cc-pl-entry-'));
    moduleFile = join(dir, 'cli.js');
    writeFileSync(moduleFile, '// entry\n');
    moduleUrl = pathToFileURL(moduleFile).href;
    binSymlink = join(dir, 'cc-powerline');
    symlinkSync(moduleFile, binSymlink);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('detects invocation through an npm bin symlink', () => {
    expect(isMainEntry(binSymlink, moduleUrl)).toBe(true);
  });

  it('detects direct `node dist/cli.js` invocation', () => {
    expect(isMainEntry(moduleFile, moduleUrl)).toBe(true);
  });

  it('returns false when a different file is the entry (imported, not run)', () => {
    const other = join(dir, 'other.js');
    writeFileSync(other, '// other\n');
    expect(isMainEntry(other, moduleUrl)).toBe(false);
  });

  it('returns false when argv[1] is missing', () => {
    expect(isMainEntry(undefined, moduleUrl)).toBe(false);
  });

  it('returns false when argv[1] points at a nonexistent path', () => {
    expect(isMainEntry(join(dir, 'nope.js'), moduleUrl)).toBe(false);
  });
});

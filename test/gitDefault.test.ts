import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveGitBranch,
  resolveGitChanges,
  resolveGitWorktree,
} from '../src/git.js';

let repo: string;

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), 'ccpl-git-'));
  const run = (cmd: string) => execSync(cmd, { cwd: repo, stdio: 'ignore' });
  run('git init -q -b trunk');
  run('git config user.email t@t.t');
  run('git config user.name t');
  await writeFile(join(repo, 'f.txt'), 'x', 'utf8');
  run('git add -A');
  run('git commit -q -m init');
});

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe('resolveGitBranch with the default (real) exec', () => {
  it('reads the current branch by shelling out to git', () => {
    expect(resolveGitBranch({ cwd: repo })).toBe('trunk');
  });

  it('returns null for a directory that is not a git repo', () => {
    expect(
      resolveGitBranch({ cwd: tmpdir() + '/definitely-not-a-repo-xyz' }),
    ).toBeNull();
  });
});

describe('resolveGitChanges with the default (real) exec', () => {
  it('is null on a clean tree and reports churn once a file is modified', async () => {
    expect(resolveGitChanges({ cwd: repo })).toBeNull();
    await writeFile(join(repo, 'f.txt'), 'x\ny\nz\n', 'utf8');
    const changes = resolveGitChanges({ cwd: repo });
    expect(changes).not.toBeNull();
    expect(changes!.added).toBeGreaterThan(0);
  });
});

describe('resolveGitWorktree with the default (real) exec', () => {
  it('is false in the main checkout and true in a linked worktree', async () => {
    expect(resolveGitWorktree({ cwd: repo })).toBe(false);
    const wt = await mkdtemp(join(tmpdir(), 'ccpl-wt-'));
    try {
      execSync(`git worktree add -q "${wt}" -b feature`, {
        cwd: repo,
        stdio: 'ignore',
      });
      expect(resolveGitWorktree({ cwd: wt })).toBe(true);
    } finally {
      execSync(`git worktree remove --force "${wt}"`, {
        cwd: repo,
        stdio: 'ignore',
      });
      await rm(wt, { recursive: true, force: true });
    }
  });

  it('is false for a directory that is not a git repo', () => {
    expect(
      resolveGitWorktree({ cwd: tmpdir() + '/definitely-not-a-repo-xyz' }),
    ).toBe(false);
  });
});

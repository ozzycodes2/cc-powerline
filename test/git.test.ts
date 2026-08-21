import { describe, it, expect } from 'vitest';
import { resolveGitBranch, resolveGitChanges } from '../src/git.js';
import type { StatusJSON } from '../src/types/StatusJSON.js';

describe('resolveGitBranch', () => {
  it('prefers the branch Claude Code already reports', () => {
    const status: StatusJSON = { worktree: { branch: 'feature/x' }, cwd: '/repo' };
    const exec = () => {
      throw new Error('should not shell out');
    };
    expect(resolveGitBranch(status, { exec })).toBe('feature/x');
  });

  it('shells out in the working directory when no branch is reported', () => {
    let seen = '';
    const exec = (cmd: string) => {
      seen = cmd;
      return 'main';
    };
    expect(resolveGitBranch({ cwd: '/repo' }, { exec })).toBe('main');
    expect(seen).toContain('git -C "/repo" rev-parse --abbrev-ref HEAD');
  });

  it('returns null with no cwd to probe', () => {
    expect(resolveGitBranch({}, { exec: () => 'main' })).toBeNull();
  });

  it('treats a detached HEAD and a failed probe as no branch', () => {
    expect(resolveGitBranch({ cwd: '/r' }, { exec: () => 'HEAD' })).toBeNull();
    expect(resolveGitBranch({ cwd: '/r' }, { exec: () => null })).toBeNull();
  });
});

describe('resolveGitChanges', () => {
  it('sums insertions and deletions across numstat rows', () => {
    let seen = '';
    const exec = (cmd: string) => {
      seen = cmd;
      return '12\t3\tsrc/a.ts\n0\t5\tsrc/b.ts';
    };
    expect(resolveGitChanges({ cwd: '/repo' }, { exec })).toEqual({ added: 12, deleted: 8 });
    expect(seen).toContain('git -C "/repo" diff --numstat HEAD');
  });

  it('skips binary rows (numstat reports "-") without corrupting the sum', () => {
    const exec = () => '-\t-\timg.png\n4\t1\tsrc/a.ts';
    expect(resolveGitChanges({ cwd: '/repo' }, { exec })).toEqual({ added: 4, deleted: 1 });
  });

  it('hides on a clean tree, a failed probe, or no cwd', () => {
    expect(resolveGitChanges({ cwd: '/repo' }, { exec: () => '' })).toBeNull();
    expect(resolveGitChanges({ cwd: '/repo' }, { exec: () => null })).toBeNull();
    expect(resolveGitChanges({}, { exec: () => '1\t1\tf' })).toBeNull();
  });

  it('falls back to workspace.project_dir when cwd is absent', () => {
    let seen = '';
    const exec = (cmd: string) => {
      seen = cmd;
      return '2\t0\tf';
    };
    expect(resolveGitChanges({ workspace: { project_dir: '/w' } }, { exec })).toEqual({
      added: 2,
      deleted: 0,
    });
    expect(seen).toContain('/w');
  });
});

import { describe, it, expect } from 'vitest';
import {
  resolveGitBranch,
  resolveGitChanges,
  resolveGitWorktree,
} from '../src/git.js';
import type { StatusJSON } from '../src/types/StatusJSON.js';

/**
 * Stub git's two rev-parse probes. `gitDir` answers `--git-dir` and `common`
 * answers `--git-common-dir`; either can be null to model a failure. Both are
 * requested with `--path-format=absolute`, so match on the trailing flag.
 */
function worktreeExec(gitDir: string | null, common: string | null) {
  return (_file: string, args: string[]) =>
    args.includes('--git-common-dir') ? common : gitDir;
}

describe('resolveGitBranch', () => {
  it('prefers the branch Claude Code already reports', () => {
    const status: StatusJSON = {
      worktree: { branch: 'feature/x' },
      cwd: '/repo',
    };
    const exec = () => {
      throw new Error('should not shell out');
    };
    expect(resolveGitBranch(status, { exec })).toBe('feature/x');
  });

  it('shells out in the working directory when no branch is reported', () => {
    let seenFile = '';
    let seenArgs: string[] = [];
    const exec = (file: string, args: string[]) => {
      seenFile = file;
      seenArgs = args;
      return 'main';
    };
    expect(resolveGitBranch({ cwd: '/repo' }, { exec })).toBe('main');
    expect(seenFile).toBe('git');
    expect(seenArgs).toEqual([
      '-C',
      '/repo',
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
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
    let seenFile = '';
    let seenArgs: string[] = [];
    const exec = (file: string, args: string[]) => {
      seenFile = file;
      seenArgs = args;
      return '12\t3\tsrc/a.ts\n0\t5\tsrc/b.ts';
    };
    expect(resolveGitChanges({ cwd: '/repo' }, { exec })).toEqual({
      added: 12,
      deleted: 8,
    });
    expect(seenFile).toBe('git');
    expect(seenArgs).toEqual(['-C', '/repo', 'diff', '--numstat', 'HEAD']);
  });

  it('skips binary rows (numstat reports "-") without corrupting the sum', () => {
    const exec = () => '-\t-\timg.png\n4\t1\tsrc/a.ts';
    expect(resolveGitChanges({ cwd: '/repo' }, { exec })).toEqual({
      added: 4,
      deleted: 1,
    });
  });

  it('hides on a clean tree, a failed probe, or no cwd', () => {
    expect(resolveGitChanges({ cwd: '/repo' }, { exec: () => '' })).toBeNull();
    expect(
      resolveGitChanges({ cwd: '/repo' }, { exec: () => null }),
    ).toBeNull();
    expect(resolveGitChanges({}, { exec: () => '1\t1\tf' })).toBeNull();
  });

  it('falls back to workspace.project_dir when cwd is absent', () => {
    let seenArgs: string[] = [];
    const exec = (_file: string, args: string[]) => {
      seenArgs = args;
      return '2\t0\tf';
    };
    expect(
      resolveGitChanges({ workspace: { project_dir: '/w' } }, { exec }),
    ).toEqual({
      added: 2,
      deleted: 0,
    });
    expect(seenArgs).toContain('/w');
  });
});

describe('resolveGitWorktree', () => {
  it('is false in the main checkout (git dir == common dir)', () => {
    // --path-format=absolute makes git canonicalize both to the same path.
    const exec = worktreeExec('/repo/.git', '/repo/.git');
    expect(resolveGitWorktree({ cwd: '/repo' }, { exec })).toBe(false);
  });

  it('is true in a linked worktree (git dir under .git/worktrees)', () => {
    const exec = worktreeExec('/repo/.git/worktrees/wt', '/repo/.git');
    expect(resolveGitWorktree({ cwd: '/wt' }, { exec })).toBe(true);
  });

  it('probes git in the working directory with absolute path formatting', () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const exec = (file: string, args: string[]) => {
      calls.push({ file, args });
      return '/repo/.git';
    };
    resolveGitWorktree({ cwd: '/repo' }, { exec });
    expect(calls[0]).toEqual({
      file: 'git',
      args: ['-C', '/repo', 'rev-parse', '--path-format=absolute', '--git-dir'],
    });
    expect(calls[1]).toEqual({
      file: 'git',
      args: [
        '-C',
        '/repo',
        'rev-parse',
        '--path-format=absolute',
        '--git-common-dir',
      ],
    });
  });

  it('is false when either probe fails or there is no cwd', () => {
    expect(
      resolveGitWorktree(
        { cwd: '/repo' },
        { exec: worktreeExec(null, '.git') },
      ),
    ).toBe(false);
    expect(
      resolveGitWorktree(
        { cwd: '/repo' },
        { exec: worktreeExec('/repo/.git', null) },
      ),
    ).toBe(false);
    expect(resolveGitWorktree({}, { exec: worktreeExec('/a', '/b') })).toBe(
      false,
    );
  });

  it('falls back to workspace.project_dir when cwd is absent', () => {
    let seenArgs: string[] = [];
    const exec = (_file: string, args: string[]) => {
      seenArgs = args;
      return args.includes('--git-common-dir')
        ? '/w/.git'
        : '/w/.git/worktrees/wt';
    };
    expect(
      resolveGitWorktree({ workspace: { project_dir: '/w' } }, { exec }),
    ).toBe(true);
    expect(seenArgs).toContain('/w');
  });
});

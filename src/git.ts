/**
 * Best-effort git branch resolution. Prefers the branch Claude Code already
 * reports in `worktree.branch`; otherwise shells out to git in the working
 * directory. Never throws — a failed probe yields `null`.
 */
import { execSync } from 'node:child_process';
import type { StatusJSON } from './types/StatusJSON.js';

export interface GitDeps {
  exec: (cmd: string) => string | null;
}

function defaultExec(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export function resolveGitBranch(status: StatusJSON, deps: GitDeps = { exec: defaultExec }): string | null {
  const reported = status.worktree?.branch;
  if (typeof reported === 'string' && reported.length > 0) {
    return reported;
  }
  const cwd = status.cwd ?? status.workspace?.project_dir;
  if (!cwd) {
    return null;
  }
  const branch = deps.exec(`git -C "${cwd}" rev-parse --abbrev-ref HEAD`);
  return branch && branch !== 'HEAD' ? branch : null;
}

/** Line churn in the working tree relative to HEAD (staged + unstaged). */
export interface GitChanges {
  added: number;
  deleted: number;
}

/**
 * Sum insertions/deletions across the working tree vs. HEAD via
 * `git diff --numstat HEAD`. Returns `null` outside a repo, on a failed probe,
 * or when the tree is clean — so the widget hides rather than showing `+0 -0`.
 * Binary files report `-` for both counts in numstat; those rows are skipped.
 */
export function resolveGitChanges(status: StatusJSON, deps: GitDeps = { exec: defaultExec }): GitChanges | null {
  const cwd = status.cwd ?? status.workspace?.project_dir;
  if (!cwd) {
    return null;
  }
  const out = deps.exec(`git -C "${cwd}" diff --numstat HEAD`);
  if (out === null) {
    return null;
  }
  let added = 0;
  let deleted = 0;
  for (const line of out.split('\n')) {
    const cols = line.trim().split('\t');
    if (cols.length < 2) {
      continue;
    }
    const a = Number(cols[0]);
    const d = Number(cols[1]);
    if (Number.isFinite(a)) {
      added += a;
    }
    if (Number.isFinite(d)) {
      deleted += d;
    }
  }
  return added === 0 && deleted === 0 ? null : { added, deleted };
}

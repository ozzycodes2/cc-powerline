/**
 * Statusline entry point. Claude Code pipes the status JSON to stdin and
 * renders whatever we write to stdout. A crash here is user-visible, so every
 * stage is defensive and the whole thing is wrapped: on any failure we emit an
 * empty line rather than an error.
 */
import { parseStatusJSON, type StatusJSON } from './types/StatusJSON.js';
import { resolvePricing } from './pricing/resolvePricing.js';
import { loadSettings } from './config/loadSettings.js';
import {
  defaultTranscriptDeps,
  loadTranscriptTotals,
} from './transcript/transcriptCache.js';
import {
  ZERO_TOTALS,
  type TranscriptTotals,
} from './transcript/parseTranscript.js';
import { resolveGitBranch, resolveGitChanges, type GitChanges } from './git.js';
import { homedir } from 'node:os';
import { statuslineWidth } from './render/terminalWidth.js';
import { buildStatus } from './pipeline.js';
import type { PricingTable } from './types/Pricing.js';
import type { Settings } from './types/Settings.js';

export interface StatuslineDeps {
  resolvePricing: () => Promise<PricingTable>;
  loadSettings: () => Promise<{ settings: Settings; warnings: string[] }>;
  loadTotals: (
    path: string | undefined,
    table: PricingTable,
  ) => Promise<TranscriptTotals>;
  resolveBranch: (status: StatusJSON) => string | null;
  resolveChanges: (status: StatusJSON) => GitChanges | null;
  now: () => number;
  home: () => string;
  width: () => number;
  warn: (message: string) => void;
}

function defaultDeps(): StatuslineDeps {
  return {
    resolvePricing: async () => (await resolvePricing()).table,
    loadSettings: async () => loadSettings(),
    loadTotals: (path, table) =>
      loadTranscriptTotals(path, table, defaultTranscriptDeps()),
    resolveBranch: (status) => resolveGitBranch(status),
    resolveChanges: (status) => resolveGitChanges(status),
    now: () => Date.now(),
    home: () => homedir(),
    width: () => statuslineWidth(),
    warn: (message) => process.stderr.write(`cc-powerline: ${message}\n`),
  };
}

/** Render a status line from raw stdin JSON. Never throws. */
export async function renderStatusline(
  input: string,
  deps: StatuslineDeps,
): Promise<string> {
  try {
    const status = parseStatusJSON(input);
    const [table, loaded] = await Promise.all([
      deps.resolvePricing(),
      deps.loadSettings(),
    ]);
    for (const w of loaded.warnings) {
      deps.warn(w);
    }

    let totals: TranscriptTotals;
    try {
      totals = await deps.loadTotals(status.transcript_path, table);
    } catch {
      totals = ZERO_TOTALS;
    }

    const ctx = {
      status,
      totals,
      git: {
        branch: deps.resolveBranch(status),
        changes: deps.resolveChanges(status),
      },
      now: deps.now(),
      home: deps.home(),
    };
    return buildStatus(loaded.settings, ctx, deps.width());
  } catch {
    return '';
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Read status JSON from stdin, render the statusline, write it to stdout.
 * Invoked by `cli.ts` when `cc-powerline` runs with no subcommand and piped
 * input — the path Claude Code uses. Never throws: emits an empty line instead.
 */
export async function main(): Promise<void> {
  let output = '';
  try {
    output = await renderStatusline(await readStdin(), defaultDeps());
  } catch {
    output = '';
  }
  process.stdout.write(output);
}

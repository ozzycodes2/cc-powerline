/**
 * Incremental transcript totals. Statuslines re-render constantly and
 * transcripts grow to megabytes, so we never re-parse the whole file when we
 * can avoid it: an on-disk cache remembers, per transcript path, the byte
 * offset parsed so far and the running totals. On the next render we read only
 * the newly-appended bytes (up to the last complete line) and fold them in. A
 * shrunk or replaced file triggers a full re-parse.
 *
 * Subagents write their own transcripts under
 * `<session-id>/subagents/agent-*.jsonl` beside the main one; each is cached
 * the same way and its spend is added to the session's.
 *
 * All IO is injectable so the incremental logic is unit-testable with a fake
 * filesystem.
 */
import { open, readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { stat as fsStat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import {
  mergeTotals,
  parseTranscript,
  ZERO_TOTALS,
  type TranscriptTotals,
} from './parseTranscript.js';
import type { PricingTable } from '../types/Pricing.js';

/** Bump when parsing changes what cached totals mean, forcing a re-parse. */
const CACHE_VERSION = 2;

interface CacheEntry {
  version?: number;
  size: number;
  byteOffset: number;
  totals: TranscriptTotals;
  lastUsageKey?: string | null;
}
type CacheStore = Record<string, CacheEntry>;

export interface FileStat {
  size: number;
}

export interface TranscriptDeps {
  stat: (path: string) => Promise<FileStat | null>;
  /** Read bytes [start, end) as UTF-8-decodable buffer. */
  readRange: (path: string, start: number, end: number) => Promise<Buffer>;
  /** Paths of the subagent transcripts spawned by a main transcript. */
  listSubagents: (path: string) => Promise<string[]>;
  readStore: () => Promise<CacheStore>;
  writeStore: (store: CacheStore) => Promise<void>;
}

/** Parse only the complete-line prefix of a buffer; report bytes consumed. */
export function parseChunk(
  buffer: Buffer,
  pricing: PricingTable,
  prevUsageKey: string | null = null,
): { delta: ReturnType<typeof parseTranscript>; consumed: number } {
  const lastNewline = buffer.lastIndexOf(0x0a);
  if (lastNewline === -1) {
    return {
      delta: parseTranscript('', pricing, prevUsageKey),
      consumed: 0,
    };
  }
  const complete = buffer.subarray(0, lastNewline + 1);
  return {
    delta: parseTranscript(complete.toString('utf8'), pricing, prevUsageKey),
    consumed: complete.length,
  };
}

/**
 * Bring one transcript's cached totals up to date, mutating `store`. Null when
 * the file does not exist.
 */
async function foldTranscript(
  path: string,
  pricing: PricingTable,
  deps: TranscriptDeps,
  store: CacheStore,
): Promise<TranscriptTotals | null> {
  const info = await deps.stat(path);
  if (!info) {
    return null;
  }

  const entry = store[path];
  const canAppend =
    entry !== undefined &&
    entry.version === CACHE_VERSION &&
    info.size >= entry.size &&
    entry.byteOffset <= info.size;

  let base: TranscriptTotals;
  let start: number;
  let lastUsageKey: string | null;
  if (canAppend) {
    base = entry!.totals;
    start = entry!.byteOffset;
    lastUsageKey = entry!.lastUsageKey ?? null;
  } else {
    base = ZERO_TOTALS;
    start = 0;
    lastUsageKey = null;
  }

  let totals = base;
  let newOffset = start;
  if (info.size > start) {
    const buffer = await deps.readRange(path, start, info.size);
    const { delta, consumed } = parseChunk(buffer, pricing, lastUsageKey);
    totals = mergeTotals(base, delta);
    newOffset = start + consumed;
    lastUsageKey = delta.lastUsageKey;
  }

  store[path] = {
    version: CACHE_VERSION,
    size: info.size,
    byteOffset: newOffset,
    totals,
    lastUsageKey,
  };
  return totals;
}

/** Add a subagent's spend to the session; context and cache state stay the main transcript's. */
function addSpend(
  session: TranscriptTotals,
  sub: TranscriptTotals,
): TranscriptTotals {
  return {
    ...session,
    costUsd: session.costUsd + sub.costUsd,
    inputTokens: session.inputTokens + sub.inputTokens,
    outputTokens: session.outputTokens + sub.outputTokens,
    cacheReadTokens: session.cacheReadTokens + sub.cacheReadTokens,
    cacheCreationTokens: session.cacheCreationTokens + sub.cacheCreationTokens,
  };
}

/**
 * Compute session totals for a main transcript plus its subagents, using and
 * updating the cache.
 */
export async function loadTranscriptTotals(
  path: string | undefined,
  pricing: PricingTable,
  deps: TranscriptDeps,
): Promise<TranscriptTotals> {
  if (!path) {
    return ZERO_TOTALS;
  }
  const store = await deps.readStore();
  let totals = await foldTranscript(path, pricing, deps, store);
  if (!totals) {
    return ZERO_TOTALS;
  }
  for (const subPath of await deps.listSubagents(path)) {
    const sub = await foldTranscript(subPath, pricing, deps, store);
    if (sub) {
      totals = addSpend(totals, sub);
    }
  }
  await deps.writeStore(store);
  return totals;
}

// --- Default filesystem-backed dependencies ---------------------------------

export function transcriptCachePath(): string {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'cc-powerline', 'transcript-cache.json');
}

/** `<dir>/<id>.jsonl` → `<dir>/<id>/subagents`. */
export function subagentDir(path: string): string {
  return join(dirname(path), basename(path, '.jsonl'), 'subagents');
}

export function defaultTranscriptDeps(
  cachePath = transcriptCachePath(),
): TranscriptDeps {
  return {
    stat: async (path) => {
      try {
        const s = await fsStat(path);
        return { size: s.size };
      } catch {
        return null;
      }
    },
    readRange: async (path, start, end) => {
      const length = end - start;
      if (length <= 0) {
        return Buffer.alloc(0);
      }
      const fh = await open(path, 'r');
      try {
        const buf = Buffer.alloc(length);
        const { bytesRead } = await fh.read(buf, 0, length, start);
        return buf.subarray(0, bytesRead);
      } finally {
        await fh.close();
      }
    },
    listSubagents: async (path) => {
      const dir = subagentDir(path);
      try {
        return (await readdir(dir))
          .filter(
            (name) => name.startsWith('agent-') && name.endsWith('.jsonl'),
          )
          .sort()
          .map((name) => join(dir, name));
      } catch {
        return [];
      }
    },
    readStore: async () => {
      try {
        return JSON.parse(await readFile(cachePath, 'utf8')) as CacheStore;
      } catch {
        return {};
      }
    },
    writeStore: async (store) => {
      try {
        await mkdir(dirname(cachePath), { recursive: true });
        await writeFile(cachePath, JSON.stringify(store), 'utf8');
      } catch {
        // best-effort; a cache we cannot persist just means a re-parse later
      }
    },
  };
}

/**
 * Incremental transcript totals. Statuslines re-render constantly and
 * transcripts grow to megabytes, so we never re-parse the whole file when we
 * can avoid it: an on-disk cache remembers, per transcript path, the byte
 * offset parsed so far and the running totals. On the next render we read only
 * the newly-appended bytes (up to the last complete line) and fold them in. A
 * shrunk or replaced file triggers a full re-parse.
 *
 * All IO is injectable so the incremental logic is unit-testable with a fake
 * filesystem.
 */
import { open, readFile, writeFile, mkdir } from 'node:fs/promises';
import { stat as fsStat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  mergeTotals,
  parseTranscript,
  ZERO_TOTALS,
  type TranscriptTotals,
} from './parseTranscript.js';
import type { PricingTable } from '../types/Pricing.js';

interface CacheEntry {
  size: number;
  byteOffset: number;
  totals: TranscriptTotals;
}
type CacheStore = Record<string, CacheEntry>;

export interface FileStat {
  size: number;
}

export interface TranscriptDeps {
  stat: (path: string) => Promise<FileStat | null>;
  /** Read bytes [start, end) as UTF-8-decodable buffer. */
  readRange: (path: string, start: number, end: number) => Promise<Buffer>;
  readStore: () => Promise<CacheStore>;
  writeStore: (store: CacheStore) => Promise<void>;
}

/** Parse only the complete-line prefix of a buffer; report bytes consumed. */
export function parseChunk(
  buffer: Buffer,
  pricing: PricingTable,
): { delta: ReturnType<typeof parseTranscript>; consumed: number } {
  const lastNewline = buffer.lastIndexOf(0x0a);
  if (lastNewline === -1) {
    return {
      delta: parseTranscript('', pricing),
      consumed: 0,
    };
  }
  const complete = buffer.subarray(0, lastNewline + 1);
  return {
    delta: parseTranscript(complete.toString('utf8'), pricing),
    consumed: complete.length,
  };
}

/** Compute running totals for a transcript, using and updating the cache. */
export async function loadTranscriptTotals(
  path: string | undefined,
  pricing: PricingTable,
  deps: TranscriptDeps,
): Promise<TranscriptTotals> {
  if (!path) {
    return ZERO_TOTALS;
  }
  const info = await deps.stat(path);
  if (!info) {
    return ZERO_TOTALS;
  }

  const store = await deps.readStore();
  const entry = store[path];
  const canAppend =
    entry !== undefined &&
    info.size >= entry.size &&
    entry.byteOffset <= info.size;

  let base: TranscriptTotals;
  let start: number;
  if (canAppend) {
    base = entry!.totals;
    start = entry!.byteOffset;
  } else {
    base = ZERO_TOTALS;
    start = 0;
  }

  let totals = base;
  let newOffset = start;
  if (info.size > start) {
    const buffer = await deps.readRange(path, start, info.size);
    const { delta, consumed } = parseChunk(buffer, pricing);
    totals = mergeTotals(base, delta);
    newOffset = start + consumed;
  }

  store[path] = { size: info.size, byteOffset: newOffset, totals };
  await deps.writeStore(store);
  return totals;
}

// --- Default filesystem-backed dependencies ---------------------------------

export function transcriptCachePath(): string {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'cc-powerline', 'transcript-cache.json');
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

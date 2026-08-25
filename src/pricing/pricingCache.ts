/**
 * On-disk pricing cache at `${XDG_CACHE_HOME:-~/.cache}/cc-powerline/
 * litellm-pricing.json`. Every operation is best-effort: read/write failures
 * resolve to `null`/`false` rather than throwing, so a broken cache never
 * takes down the statusline.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { PricingTable } from '../types/Pricing.js';

export interface CachedPricing {
  fetchedAt: number;
  table: PricingTable;
}

/** Absolute path to the pricing cache file. */
export function pricingCachePath(): string {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'cc-powerline', 'litellm-pricing.json');
}

/** Read the cache. Returns `null` on any error or malformed content. */
export async function readPricingCache(
  path = pricingCachePath(),
): Promise<CachedPricing | null> {
  try {
    const text = await readFile(path, 'utf8');
    const parsed = JSON.parse(text) as CachedPricing;
    if (
      parsed &&
      typeof parsed.fetchedAt === 'number' &&
      parsed.table &&
      typeof parsed.table === 'object'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Write the cache. Returns `false` on any error (never throws). */
export async function writePricingCache(
  table: PricingTable,
  now: number,
  path = pricingCachePath(),
): Promise<boolean> {
  try {
    await mkdir(dirname(path), { recursive: true });
    const payload: CachedPricing = { fetchedAt: now, table };
    await writeFile(path, JSON.stringify(payload), 'utf8');
    return true;
  } catch {
    return false;
  }
}

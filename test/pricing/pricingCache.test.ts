import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  pricingCachePath,
  readPricingCache,
  writePricingCache,
} from '../../src/pricing/pricingCache.js';
import type { PricingTable } from '../../src/types/Pricing.js';

const created: string[] = [];
afterEach(async () => {
  await Promise.all(
    created.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});

async function tmp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ccpl-price-'));
  created.push(dir);
  return dir;
}

const TABLE: PricingTable = {
  m: { input: 1e-6, output: 2e-6, cacheCreate: 1e-6, cacheRead: 1e-7 },
};

describe('pricingCachePath', () => {
  it('honors XDG_CACHE_HOME when set', () => {
    const prev = process.env.XDG_CACHE_HOME;
    process.env.XDG_CACHE_HOME = '/tmp/xdg';
    try {
      expect(pricingCachePath()).toBe(
        '/tmp/xdg/cc-powerline/litellm-pricing.json',
      );
    } finally {
      if (prev === undefined) delete process.env.XDG_CACHE_HOME;
      else process.env.XDG_CACHE_HOME = prev;
    }
  });
});

describe('pricing cache round-trip', () => {
  it('writes then reads back the table with its timestamp', async () => {
    const path = join(await tmp(), 'nested', 'pricing.json');
    expect(await writePricingCache(TABLE, 123, path)).toBe(true);
    const back = await readPricingCache(path);
    expect(back).toEqual({ fetchedAt: 123, table: TABLE });
  });

  it('returns null for a missing file', async () => {
    expect(await readPricingCache(join(await tmp(), 'gone.json'))).toBeNull();
  });

  it('returns null for malformed or wrong-shaped content', async () => {
    const dir = await tmp();
    const bad = join(dir, 'bad.json');
    await writeFile(bad, '{not json', 'utf8');
    expect(await readPricingCache(bad)).toBeNull();

    const wrong = join(dir, 'wrong.json');
    await writeFile(
      wrong,
      JSON.stringify({ fetchedAt: 'x', table: {} }),
      'utf8',
    );
    expect(await readPricingCache(wrong)).toBeNull();
  });

  it('returns false when the path cannot be written', async () => {
    // A path whose parent is an existing file cannot be mkdir'd.
    const dir = await tmp();
    const file = join(dir, 'afile');
    await writeFile(file, 'x', 'utf8');
    expect(await writePricingCache(TABLE, 1, join(file, 'child.json'))).toBe(
      false,
    );
  });
});

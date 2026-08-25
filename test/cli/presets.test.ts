import { describe, it, expect } from 'vitest';
import {
  PRESETS,
  DEFAULT_PRESET_KEY,
  presetByKey,
} from '../../src/cli/presets.js';

describe('presetByKey', () => {
  it('returns the matching preset', () => {
    expect(presetByKey('ocean').key).toBe('ocean');
  });

  it('falls back to the default preset for an unknown key', () => {
    expect(presetByKey('does-not-exist').key).toBe(DEFAULT_PRESET_KEY);
  });

  it('every preset has at least one background color', () => {
    for (const p of PRESETS) {
      expect(p.bgs.length).toBeGreaterThan(0);
    }
  });
});

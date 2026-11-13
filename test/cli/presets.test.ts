import { describe, it, expect } from 'vitest';
import {
  PRESETS,
  DEFAULT_PRESET_KEY,
  presetByKey,
} from '../../src/cli/presets.js';
import { applyPalette } from '../../src/config/palette.js';
import { DEFAULT_SETTINGS } from '../../src/config/defaultSettings.js';

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

  it('defaults to the Fabric ANSI hues, without red', () => {
    expect(DEFAULT_PRESET_KEY).toBe('fabric');
    expect(presetByKey('fabric').bgs).toEqual([
      '#6f93c0',
      '#6aaea6',
      '#8db05a',
      '#f0b92a',
      '#c08a9a',
    ]);
  });

  it('fabric-signal leads with the Fabric accent over its neutral grays', () => {
    expect(presetByKey('fabric-signal').bgs).toEqual([
      '#ff6a13',
      '#3b3b41',
      '#8a8f98',
      '#45454b',
    ]);
  });

  it('the default settings are painted from the default preset', () => {
    expect(
      applyPalette(DEFAULT_SETTINGS, presetByKey(DEFAULT_PRESET_KEY)),
    ).toEqual(DEFAULT_SETTINGS);
  });
});

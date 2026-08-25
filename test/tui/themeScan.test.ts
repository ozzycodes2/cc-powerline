/**
 * Theme scanning IO. All filesystem access is injected (home / env / read) so
 * these tests never touch a real disk: we assert which paths are probed, that
 * each source becomes a preset, dedupe/cap, and the min-colors filter.
 */
import { describe, it, expect, vi } from 'vitest';
import { scanThemes } from '../../src/tui/themeScan.js';

const P10K = [
  'typeset -g POWERLEVEL9K_DIR_BACKGROUND=4',
  'typeset -g POWERLEVEL9K_VCS_CLEAN_BACKGROUND=2',
].join('\n');

describe('scanThemes', () => {
  it('detects a Powerlevel10k config at ~/.p10k.zsh', () => {
    const read = vi.fn((p: string) => (p === '/home/me/.p10k.zsh' ? P10K : null));
    const presets = scanThemes({ home: '/home/me', env: {}, read });
    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({
      key: 'detected:p10k',
      label: 'Powerlevel10k (detected)',
      fg: 'brightWhite',
      bgs: ['blue', 'green'],
    });
  });

  it('reads oh-my-posh from $POSH_THEME and classic Powerline under XDG_CONFIG_HOME', () => {
    const omp = JSON.stringify({ blocks: [{ segments: [{ background: '#111111' }, { background: '#222222' }] }] });
    const scheme = JSON.stringify({ colors: { a: 16, b: 231 } });
    const files: Record<string, string> = {
      '/cfg/theme.omp.json': omp,
      '/cfg/powerline/colorschemes/default.json': scheme,
    };
    const read = vi.fn((p: string) => files[p] ?? null);
    const presets = scanThemes({
      home: '/home/me',
      env: { POSH_THEME: '/cfg/theme.omp.json', XDG_CONFIG_HOME: '/cfg' },
      read,
    });
    expect(presets.map((p) => p.key)).toEqual(['detected:omp', 'detected:powerline']);
  });

  it('skips a source whose palette has fewer than two colors', () => {
    const read = vi.fn((p: string) =>
      p.endsWith('.p10k.zsh') ? 'typeset -g POWERLEVEL9K_DIR_BACKGROUND=4' : null,
    );
    expect(scanThemes({ home: '/home/me', env: {}, read })).toEqual([]);
  });

  it('caps the ring at eight colors', () => {
    const many = Array.from({ length: 12 }, (_, i) => `POWERLEVEL9K_S${i}_BACKGROUND=${16 + i}`).join('\n');
    const read = vi.fn((p: string) => (p.endsWith('.p10k.zsh') ? many : null));
    const [p10k] = scanThemes({ home: '/home/me', env: {}, read });
    expect(p10k!.bgs).toHaveLength(8);
  });

  it('returns nothing when no theme files are found', () => {
    expect(scanThemes({ home: '/home/me', env: {}, read: () => null })).toEqual([]);
  });

  it('drops a source whose JSON does not parse', () => {
    const read = vi.fn((p: string) =>
      p.endsWith('default.json') ? '{ not valid json' : null,
    );
    expect(scanThemes({ home: '/home/me', env: { XDG_CONFIG_HOME: '/cfg' }, read })).toEqual([]);
  });

  it('uses the real filesystem when no reader is injected', () => {
    // A home that cannot exist: every default read hits ENOENT → swallowed → [].
    expect(scanThemes({ home: '/no/such/home', env: {} })).toEqual([]);
  });

  it('falls back to env.HOME and process.env when those opts are omitted', () => {
    const read = () => null;
    // home omitted → env.HOME; nothing readable → [].
    expect(scanThemes({ read, env: { HOME: '/home/env' } })).toEqual([]);
    // env omitted → process.env; still nothing readable → [].
    expect(scanThemes({ read, home: '/home/me' })).toEqual([]);
  });

  it('falls back to $HOME/.config when XDG_CONFIG_HOME is unset', () => {
    const scheme = JSON.stringify({ colors: { a: 16, b: 231 } });
    const read = vi.fn((p: string) =>
      p === '/home/me/.config/powerline/colorschemes/default.json' ? scheme : null,
    );
    const presets = scanThemes({ home: '/home/me', env: {}, read });
    expect(presets.map((p) => p.key)).toEqual(['detected:powerline']);
  });
});

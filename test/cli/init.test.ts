import { describe, it, expect } from 'vitest';
import { buildSettingsFromAnswers, renderPreview, runInit } from '../../src/cli/init.js';
import { presetByKey } from '../../src/cli/presets.js';
import { stripAnsi } from '../../src/render/stripAnsi.js';
import type { PromptIO } from '../../src/cli/prompts.js';
import type { Settings } from '../../src/types/Settings.js';

describe('buildSettingsFromAnswers', () => {
  it('maps widgets to items with the preset fg and round-robin bg', () => {
    const preset = presetByKey('mono');
    const s = buildSettingsFromAnswers({
      style: 'powerline',
      left: ['model', 'git-branch'],
      right: ['session-cost'],
      preset: 'mono',
    });
    expect(s.style).toBe('powerline');
    expect(s.lines[0]!.left).toEqual([
      { type: 'model', fg: preset.fg, bg: preset.bgs[0] },
      { type: 'git-branch', fg: preset.fg, bg: preset.bgs[1] },
    ]);
    expect(s.lines[0]!.right).toEqual([
      { type: 'session-cost', fg: preset.fg, bg: preset.bgs[0] },
    ]);
  });

  it('drops the right group entirely for the builtin style', () => {
    const s = buildSettingsFromAnswers({
      style: 'builtin',
      left: ['model'],
      right: ['session-cost', 'context-length'],
      preset: 'slate',
    });
    expect(s.style).toBe('builtin');
    expect(s.lines[0]!.right).toEqual([]);
  });

  it('cycles the background ring when widgets outnumber colors', () => {
    const preset = presetByKey('mono'); // 4 colors
    const s = buildSettingsFromAnswers({
      style: 'powerline',
      left: ['model', 'git-branch', 'directory', 'context-length', 'session-cost'],
      right: [],
      preset: 'mono',
    });
    expect(s.lines[0]!.left[4]!.bg).toBe(preset.bgs[0]); // wraps at index 4
  });
});

describe('renderPreview', () => {
  it('populates every selected widget with mock data', () => {
    const settings: Settings = {
      style: 'powerline',
      lines: [
        {
          left: [
            { type: 'model' },
            { type: 'model-effort' },
            { type: 'git-branch' },
            { type: 'git-changes' },
            { type: 'directory' },
            { type: 'context-length' },
            { type: 'session-cost' },
            { type: 'cache-hit-rate' },
            { type: 'cache-window' },
            { type: 'compactions' },
            { type: 'rate-limit' },
          ],
          right: [],
        },
      ],
    };
    const out = stripAnsi(renderPreview(settings, 200));
    // Widgets that hide against the sparse fixture all render here.
    expect(out).toContain('Opus 4.8');
    expect(out).toContain('high'); // effort
    expect(out).toContain('main'); // branch
    expect(out).toContain('+12 -3'); // churn
    expect(out).toContain('~/D/w/voice-connect'); // compressed dir
    expect(out).toContain('42%'); // context
    expect(out).toContain('cache:90%');
    expect(out).toContain('4:43'); // cache-window countdown
    expect(out).toContain('5h:18%');
  });
});

/** Scripted IO that answers prompts in sequence. */
function scriptedIO(answers: string[]): PromptIO {
  const queue = [...answers];
  return {
    ask: async () => queue.shift() ?? '',
    write: () => {},
    close: () => {},
  };
}

describe('runInit', () => {
  it('drives the powerline flow and persists the built settings', async () => {
    let written: Settings | null = null;
    let logged = '';
    const logs: string[] = [];
    // style=1(powerline); left picks model(1),git-branch(3),directory(5);
    // right picks context-length(6),session-cost(7),cache-hit-rate(8); preset=3(ocean)
    const settings = await runInit({
      io: scriptedIO(['1', '1,3,5', '6,7,8', '3']),
      previewWidth: 200,
      writeConfig: async (s) => {
        written = s;
        return '/cfg/settings.json';
      },
      log: (m) => {
        logged = m;
        logs.push(m);
      },
    });

    // A mock-data preview is shown before the save confirmation.
    expect(logs).toContain('Preview (with sample data):');
    expect(stripAnsi(logs.join('\n'))).toContain('main'); // git-branch populated in preview

    expect(settings.style).toBe('powerline');
    expect(settings.lines[0]!.left.map((w) => w.type)).toEqual(['model', 'git-branch', 'directory']);
    expect(settings.lines[0]!.right.map((w) => w.type)).toEqual([
      'context-length',
      'session-cost',
      'cache-hit-rate',
    ]);
    expect(settings.lines[0]!.left[0]!.bg).toBe(presetByKey('ocean').bgs[0]);
    expect(written).toEqual(settings);
    expect(logged).toContain('/cfg/settings.json');
  });

  it('skips the right-widget prompt when builtin is chosen', async () => {
    const asked: string[] = [];
    const io: PromptIO = {
      ask: async (q) => {
        asked.push(q);
        // style prompt → builtin (2); left prompt → defaults (empty); preset → default (empty)
        if (asked.length === 1) return '2';
        return '';
      },
      write: () => {},
      close: () => {},
    };
    const settings = await runInit({ io, writeConfig: async () => '/x', log: () => {} });
    expect(settings.style).toBe('builtin');
    expect(settings.lines[0]!.right).toEqual([]);
    // exactly three questions asked: style, left, preset (no right)
    expect(asked).toHaveLength(3);
  });

  it('closes the IO even if writing throws', async () => {
    let closed = false;
    const io: PromptIO = { ask: async () => '', write: () => {}, close: () => (closed = true) };
    await expect(
      runInit({
        io,
        writeConfig: async () => {
          throw new Error('disk full');
        },
        log: () => {},
      }),
    ).rejects.toThrow('disk full');
    expect(closed).toBe(true);
  });
});

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
      lines: [{ left: ['model', 'git-branch'], right: [] }],
      preset: 'mono',
    });
    expect(s.style).toBe('powerline');
    expect(s.lines[0]!.left).toEqual([
      { type: 'model', fg: preset.fg, bg: preset.bgs[0] },
      { type: 'git-branch', fg: preset.fg, bg: preset.bgs[1] },
    ]);
    expect(s.lines[0]!.right).toEqual([]);
  });

  it('restarts the background ring on each line rather than continuing it', () => {
    const preset = presetByKey('mono');
    const s = buildSettingsFromAnswers({
      style: 'powerline',
      lines: [
        { left: ['model', 'git-branch'], right: [] },
        { left: [], right: ['session-cost'] },
      ],
      preset: 'mono',
    });
    // Each line's populated side leads with the preset's first color, so the
    // second line does not pick up where the first left off.
    expect(s.lines[0]!.left[0]!.bg).toBe(preset.bgs[0]);
    expect(s.lines[1]!.left).toEqual([]);
    expect(s.lines[1]!.right).toEqual([
      { type: 'session-cost', fg: preset.fg, bg: preset.bgs[0] },
    ]);
  });

  it('drops the right group entirely for the builtin style', () => {
    const s = buildSettingsFromAnswers({
      style: 'builtin',
      lines: [{ left: ['model'], right: ['session-cost', 'context-length'] }],
      preset: 'slate',
    });
    expect(s.style).toBe('builtin');
    expect(s.lines[0]!.right).toEqual([]);
  });

  it('cycles the background ring when widgets outnumber colors', () => {
    const preset = presetByKey('mono'); // 4 colors
    const s = buildSettingsFromAnswers({
      style: 'powerline',
      lines: [
        { left: ['model', 'git-branch', 'directory', 'context-length', 'session-cost'], right: [] },
      ],
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
    expect(out).toContain('\u{f1c0} 90%'); // cache-hit-rate icon + value
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
  it('drives a multi-line powerline flow and persists the built settings', async () => {
    let written: Settings | null = null;
    const logs: string[] = [];
    // style=1(powerline); 2 lines.
    // line 1: left model(1),git-branch(3),directory(5); right skipped.
    // line 2: left skipped; right context-length(6),session-cost(7).
    // preset=3(ocean).
    const settings = await runInit({
      io: scriptedIO(['1', '2', '1,3,5', '', '', '6,7', '3']),
      previewWidth: 200,
      writeConfig: async (s) => {
        written = s;
        return '/cfg/settings.json';
      },
      log: (m) => {
        logs.push(m);
      },
    });

    // A mock-data preview is shown before the save confirmation.
    expect(logs).toContain('Preview (with sample data):');
    expect(stripAnsi(logs.join('\n'))).toContain('main'); // git-branch populated in preview

    expect(settings.style).toBe('powerline');
    expect(settings.lines).toHaveLength(2);
    expect(settings.lines[0]!.left.map((w) => w.type)).toEqual(['model', 'git-branch', 'directory']);
    expect(settings.lines[0]!.right).toEqual([]);
    expect(settings.lines[1]!.left).toEqual([]);
    expect(settings.lines[1]!.right.map((w) => w.type)).toEqual(['context-length', 'session-cost']);
    // Every line's populated side restarts the color ring.
    expect(settings.lines[0]!.left[0]!.bg).toBe(presetByKey('ocean').bgs[0]);
    expect(settings.lines[1]!.right[0]!.bg).toBe(presetByKey('ocean').bgs[0]);
    expect(written).toEqual(settings);
    // The wizard no longer logs the settings path.
    expect(logs.join('\n')).not.toContain('/cfg/settings.json');
  });

  it('re-asks a powerline line whose picks land on both sides', async () => {
    const notes: string[] = [];
    // style=1; 1 line. First attempt: left=1 AND right=1 (rejected). Retry:
    // left=2, right skipped. preset default.
    const settings = await runInit({
      io: {
        ask: (() => {
          const queue = ['1', '1', '1', '1', '2', '', ''];
          return async () => queue.shift() ?? '';
        })(),
        write: (t) => notes.push(t),
        close: () => {},
      },
      previewWidth: 80,
      writeConfig: async () => '/x',
      log: () => {},
    });
    expect(settings.lines[0]!.left.map((w) => w.type)).toEqual(['model-effort']);
    expect(settings.lines[0]!.right).toEqual([]);
    expect(notes.some((n) => /one side only/i.test(n))).toBe(true);
  });

  it('re-asks a powerline line left entirely empty', async () => {
    const notes: string[] = [];
    // style=1; 1 line. First attempt: both sides empty (rejected). Retry:
    // left=1, right skipped. preset default.
    const settings = await runInit({
      io: {
        ask: (() => {
          const queue = ['1', '1', '', '', '1', '', ''];
          return async () => queue.shift() ?? '';
        })(),
        write: (t) => notes.push(t),
        close: () => {},
      },
      previewWidth: 80,
      writeConfig: async () => '/x',
      log: () => {},
    });
    expect(settings.lines[0]!.left.map((w) => w.type)).toEqual(['model']);
    expect(notes.some((n) => /at least one widget/i.test(n))).toBe(true);
  });

  it('never prompts for a right group under the builtin style', async () => {
    const prompts: string[] = [];
    const asked: string[] = [];
    const io: PromptIO = {
      ask: async (q) => {
        asked.push(q);
        if (asked.length === 1) return '2'; // style → builtin
        if (asked.length === 2) return '1'; // how many lines → 1
        if (asked.length === 3) return '1'; // line 1 widgets → model
        return ''; // preset → default
      },
      write: (t) => prompts.push(t),
      close: () => {},
    };
    const settings = await runInit({ io, previewWidth: 80, writeConfig: async () => '/x', log: () => {} });
    expect(settings.style).toBe('builtin');
    expect(settings.lines).toHaveLength(1);
    expect(settings.lines[0]!.left.map((w) => w.type)).toEqual(['model']);
    expect(settings.lines[0]!.right).toEqual([]);
    // Built-in has no right group, so no prompt ever mentions one.
    expect(prompts.some((p) => /right/i.test(p))).toBe(false);
    // style, how-many-lines, line-1 widgets, preset — and nothing more.
    expect(asked).toHaveLength(4);
  });

  it('re-asks a builtin line that selects no widgets', async () => {
    const notes: string[] = [];
    // style=2; 1 line. First attempt: no widgets (rejected). Retry: model(1).
    // preset default.
    const settings = await runInit({
      io: {
        ask: (() => {
          const queue = ['2', '1', '', '1', ''];
          return async () => queue.shift() ?? '';
        })(),
        write: (t) => notes.push(t),
        close: () => {},
      },
      previewWidth: 80,
      writeConfig: async () => '/x',
      log: () => {},
    });
    expect(settings.lines[0]!.left.map((w) => w.type)).toEqual(['model']);
    expect(notes.some((n) => /at least one widget for this line/i.test(n))).toBe(true);
  });

  it('closes the IO even if writing throws', async () => {
    let closed = false;
    // powerline, 1 line, left=model, right skipped, default preset.
    const queue = ['1', '1', '1', '', ''];
    const io: PromptIO = {
      ask: async () => queue.shift() ?? '',
      write: () => {},
      close: () => {
        closed = true;
      },
    };
    await expect(
      runInit({
        io,
        previewWidth: 80,
        writeConfig: async () => {
          throw new Error('disk full');
        },
        log: () => {},
      }),
    ).rejects.toThrow('disk full');
    expect(closed).toBe(true);
  });
});

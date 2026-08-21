import { describe, it, expect } from 'vitest';
import { buildStatus } from '../src/pipeline.js';
import { stripAnsi } from '../src/render/stripAnsi.js';
import { ZERO_TOTALS } from '../src/transcript/parseTranscript.js';
import type { Settings } from '../src/types/Settings.js';
import type { WidgetContext } from '../src/widgets/Widget.js';

const ctx: WidgetContext = {
  status: { model: { display_name: 'Opus' }, cwd: '/a/proj' },
  totals: { ...ZERO_TOTALS, costUsd: 0.25 },
  git: { branch: 'main' },
};

describe('buildStatus', () => {
  it('renders the builtin style as plain fg-colored text with no right group', () => {
    const settings: Settings = {
      style: 'builtin',
      lines: [{ left: [{ type: 'model' }, { type: 'directory' }], right: [{ type: 'session-cost' }] }],
    };
    const out = stripAnsi(buildStatus(settings, ctx, 80));
    expect(out).toContain('Opus');
    expect(out).toContain('proj');
    // builtin ignores the right group
    expect(out).not.toContain('$0.2500');
  });

  it('renders one output line per configured line', () => {
    const settings: Settings = {
      style: 'builtin',
      lines: [{ left: [{ type: 'model' }], right: [] }, { left: [{ type: 'directory' }], right: [] }],
    };
    const out = stripAnsi(buildStatus(settings, ctx, 80));
    expect(out.split('\n')).toHaveLength(2);
  });

  it('renders the powerline style with left and right groups', () => {
    const settings: Settings = {
      style: 'powerline',
      lines: [
        {
          left: [{ type: 'model', bg: '#005f87' }],
          right: [{ type: 'session-cost', bg: '#5f0000' }],
        },
      ],
    };
    const rendered = buildStatus(settings, ctx, 80);
    const plain = stripAnsi(rendered);
    expect(plain).toContain('Opus');
    expect(plain).toContain('$0.2500');
    // powerline emits ANSI color codes
    expect(rendered).not.toBe(plain);
  });

  it('omits hidden widgets (null render) from the line', () => {
    const settings: Settings = {
      style: 'builtin',
      lines: [{ left: [{ type: 'model' }, { type: 'rate-limit' }], right: [] }],
    };
    const out = stripAnsi(buildStatus(settings, ctx, 80));
    expect(out).toContain('Opus');
    expect(out).not.toContain('5h:');
  });
});

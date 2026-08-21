import { describe, it, expect } from 'vitest';
import { buildStatus } from '../src/pipeline.js';
import { stripAnsi } from '../src/render/stripAnsi.js';
import { ZERO_TOTALS } from '../src/transcript/parseTranscript.js';
import { SettingsSchema } from '../src/types/Settings.js';
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

  it('applies line-level default colors through resolveSettings', () => {
    const settings = SettingsSchema.parse({
      style: 'powerline',
      lines: [{ defaults: { bg: '#654321' }, left: [{ type: 'model' }] }],
    });
    const line = buildStatus(settings, ctx, 200);
    // the model segment must be colored with the line default bg (48;2;101;67;33)
    expect(line).toContain('48;2;101;67;33');
  });

  it('does not colorize builtin segments that only inherit the theme default', () => {
    const settings = SettingsSchema.parse({
      style: 'builtin',
      lines: [{ left: [{ type: 'model' }] }],
    });
    const out = buildStatus(settings, ctx, 80);
    // no item/line color was set, so builtin must stay plain text (no ANSI
    // codes), matching the pre-resolver behavior the golden snapshots pin.
    expect(out).toBe(stripAnsi(out));
  });

  it('still colorizes builtin segments with an explicit item color', () => {
    const settings = SettingsSchema.parse({
      style: 'builtin',
      lines: [{ left: [{ type: 'model', fg: '#005f87' }] }],
    });
    const out = buildStatus(settings, ctx, 80);
    expect(out).toContain('38;2;0;95;135');
  });
});

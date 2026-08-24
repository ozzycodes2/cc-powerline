import { describe, it, expect } from 'vitest';
import { previewContext, deepMerge } from '../../src/cli/previewContext.js';
import { renderWidget, WIDGET_DEFS } from '../../src/widgets/registry.js';
import type { WidgetDef } from '../../src/widgets/Widget.js';

describe('deepMerge', () => {
  it('recursively merges sibling keys without clobbering', () => {
    const merged = deepMerge({ git: { branch: 'x' } }, { git: { changes: { added: 1, deleted: 0 } } });
    expect(merged).toEqual({ git: { branch: 'x', changes: { added: 1, deleted: 0 } } });
  });
});

describe('previewContext derivation', () => {
  it('renders every widget that declares a sample to a non-null value', () => {
    const ctx = previewContext();
    for (const d of WIDGET_DEFS) {
      if (d.sample) {
        expect(renderWidget(d.type, ctx)).not.toBeNull();
      }
    }
  });

  it('reproduces the canonical preview values', () => {
    const ctx = previewContext();
    expect(renderWidget('model', ctx)).toBe('Opus 4.8');
    expect(renderWidget('directory', ctx)).toBe('~/D/w/voice-connect');
    expect(renderWidget('cache-hit-rate', ctx)).toBe('\u{f1c0} 90%');
    expect(renderWidget('cache-window', ctx)).toBe(`${'\u{f017}'} 4:43`);
    expect(renderWidget('session-cost', ctx)).toBe('$1.23');
    expect(renderWidget('next-cost', ctx)).toBe('4¢→53¢');
  });

  it('auto-includes a newly registered widget in the preview (extensibility invariant)', () => {
    const fake: WidgetDef = {
      type: 'fake-xyz',
      options: WIDGET_DEFS[0]!.options,
      render: (c) => (c.status.session_id === 'sample-xyz' ? 'FAKE' : null),
      sample: () => ({ status: { session_id: 'sample-xyz' } }),
    };
    const ctx = previewContext([...WIDGET_DEFS, fake]);
    expect(fake.render(ctx, {})).toBe('FAKE');
  });
});

import { describe, it, expect } from 'vitest';
import {
  WIDGET_DEFS,
  WIDGET_TYPES,
  parseWidgetOptions,
} from '../../src/widgets/registry.js';

describe('widget descriptors', () => {
  it('every widget declares an options schema', () => {
    for (const d of WIDGET_DEFS) {
      expect(typeof d.options.safeParse).toBe('function');
    }
  });

  it('WIDGET_DEFS order matches WIDGET_TYPES', () => {
    expect(WIDGET_DEFS.map((d) => d.type)).toEqual(WIDGET_TYPES);
  });

  it('parseWidgetOptions fills defaults and degrades bad input', () => {
    // git-branch defaults: branch glyph U+E0A0, main U+F015, worktree U+F126.
    const gitBranchDefaults = {
      icon: '\u{e0a0}',
      mainIcon: '\u{f015}',
      worktreeIcon: '\u{f126}',
    };
    expect(parseWidgetOptions('git-branch', {})).toEqual(gitBranchDefaults);
    // wrong type degrades to defaults rather than throwing
    expect(parseWidgetOptions('git-branch', { icon: 123 })).toEqual(
      gitBranchDefaults,
    );
    // unknown widget → empty options
    expect(parseWidgetOptions('nope', { x: 1 })).toEqual({});
  });
});

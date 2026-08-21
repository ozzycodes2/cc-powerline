import { describe, it, expect } from 'vitest';
import { prefixed, prefixIcon, prefixLabel } from '../../src/widgets/compose.js';
import type { WidgetContext } from '../../src/widgets/Widget.js';

const ctx = {} as WidgetContext;

describe('prefixed', () => {
  it('hides when the core value is null or empty', () => {
    expect(prefixed('icon', ' ', 'skip-empty', () => null)(ctx, {})).toBeNull();
    expect(prefixed('icon', ' ', 'skip-empty', () => '')(ctx, {})).toBeNull();
  });

  it('skip-empty omits the prefix when the option is empty', () => {
    const r = prefixed<{ icon?: string }>('icon', ' ', 'skip-empty', () => 'body');
    expect(r(ctx, {})).toBe('body');
    expect(r(ctx, { icon: '' })).toBe('body');
    expect(r(ctx, { icon: 'X' })).toBe('X body');
  });

  it('always joins with the separator, even when the option is empty', () => {
    const r = prefixed<{ label?: string }>('label', ':', 'always', () => 'v');
    expect(r(ctx, { label: 'cache' })).toBe('cache:v');
    expect(r(ctx, { label: '' })).toBe(':v');
  });
});

describe('prefixIcon / prefixLabel', () => {
  it('prefixIcon is icon + space, skip-empty', () => {
    const r = prefixIcon<{ icon?: string }>(() => 'main');
    expect(r(ctx, { icon: 'g' })).toBe('g main');
    expect(r(ctx, { icon: '' })).toBe('main');
  });
  it('prefixLabel is label + colon by default, always', () => {
    const r = prefixLabel<{ label?: string }>(() => '75%');
    expect(r(ctx, { label: 'cache' })).toBe('cache:75%');
  });
});

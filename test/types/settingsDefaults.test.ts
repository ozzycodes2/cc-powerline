import { describe, it, expect } from 'vitest';
import { SettingsSchema } from '../../src/types/Settings.js';

describe('line-level defaults', () => {
  it('parses optional per-line fg/bg defaults', () => {
    const parsed = SettingsSchema.parse({
      style: 'powerline',
      lines: [
        { left: [{ type: 'model' }], defaults: { fg: 'white', bg: '#123456' } },
      ],
    });
    expect(parsed.lines[0]!.defaults).toEqual({ fg: 'white', bg: '#123456' });
  });

  it('leaves defaults undefined when omitted (back-compat)', () => {
    const parsed = SettingsSchema.parse({
      lines: [{ left: [{ type: 'model' }] }],
    });
    expect(parsed.lines[0]!.defaults).toBeUndefined();
  });
});

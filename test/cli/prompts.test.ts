import { describe, it, expect } from 'vitest';
import {
  confirm,
  select,
  multiSelect,
  promptNumber,
  type PromptIO,
  type Choice,
} from '../../src/cli/prompts.js';

/** A scripted IO: dequeues answers in order, records everything written. */
function scriptedIO(answers: string[]): {
  io: PromptIO;
  out: string[];
  asked: string[];
} {
  const out: string[] = [];
  const asked: string[] = [];
  const queue = [...answers];
  const io: PromptIO = {
    ask: async (q) => {
      asked.push(q);
      return queue.shift() ?? '';
    },
    write: (t) => out.push(t),
    close: () => {},
  };
  return { io, out, asked };
}

const abc: Choice<string>[] = [
  { label: 'a', value: 'a' },
  { label: 'b', value: 'b' },
  { label: 'c', value: 'c' },
];

describe('select', () => {
  it('returns the chosen 1-based option', async () => {
    const { io } = scriptedIO(['2']);
    expect(await select(io, 'pick', abc)).toBe('b');
  });

  it('renders the message and a numbered menu', async () => {
    const { io, out } = scriptedIO(['1']);
    await select(io, 'pick one', abc);
    expect(out[0]).toBe('pick one');
    expect(out).toContain('  1) a');
    expect(out).toContain('  3) c');
  });

  it('falls back to the default on empty input', async () => {
    const { io } = scriptedIO(['']);
    expect(await select(io, 'pick', abc, 2)).toBe('c');
  });

  it('falls back to the default on out-of-range or garbage input', async () => {
    expect(await select(scriptedIO(['9']).io, 'pick', abc, 1)).toBe('b');
    expect(await select(scriptedIO(['xyz']).io, 'pick', abc, 0)).toBe('a');
  });
});

describe('promptNumber', () => {
  const opts = { def: 1, min: 1, max: 5 };

  it('returns a valid in-range number', async () => {
    const { io } = scriptedIO(['3']);
    expect(await promptNumber(io, 'how many', opts)).toBe(3);
  });

  it('renders the range and default in the prompt text', async () => {
    const { io, asked } = scriptedIO(['1']);
    await promptNumber(io, 'how many', opts);
    expect(asked[0]).toBe('how many [1-5] (default 1): ');
  });

  it('falls back to the default on empty input', async () => {
    const { io } = scriptedIO(['']);
    expect(await promptNumber(io, 'how many', { def: 2, min: 1, max: 5 })).toBe(
      2,
    );
  });

  it('falls back to the default on out-of-range or garbage input', async () => {
    expect(await promptNumber(scriptedIO(['9']).io, 'how many', opts)).toBe(1);
    expect(await promptNumber(scriptedIO(['0']).io, 'how many', opts)).toBe(1);
    expect(await promptNumber(scriptedIO(['xyz']).io, 'how many', opts)).toBe(
      1,
    );
  });
});

describe('multiSelect', () => {
  const choices: Choice<string>[] = [
    { label: 'a', value: 'a', checked: true },
    { label: 'b', value: 'b' },
    { label: 'c', value: 'c', checked: true },
  ];

  it('returns the pre-checked defaults on empty input', async () => {
    const { io } = scriptedIO(['']);
    expect(await multiSelect(io, 'pick', choices)).toEqual(['a', 'c']);
  });

  it('parses a comma/space list, preserving menu order and dropping dupes', async () => {
    const { io } = scriptedIO(['3, 1 1']);
    expect(await multiSelect(io, 'pick', choices)).toEqual(['a', 'c']);
  });

  it('ignores out-of-range indices', async () => {
    const { io } = scriptedIO(['2,7']);
    expect(await multiSelect(io, 'pick', choices)).toEqual(['b']);
  });

  it('can select nothing when only invalid tokens are given', async () => {
    const { io } = scriptedIO(['0']);
    expect(await multiSelect(io, 'pick', choices)).toEqual([]);
  });
});

describe('confirm', () => {
  it('returns the default on empty input', async () => {
    expect(await confirm(scriptedIO(['']).io, 'ok?', true)).toBe(true);
    expect(await confirm(scriptedIO(['']).io, 'ok?', false)).toBe(false);
  });

  it('accepts y/yes and n/no case-insensitively', async () => {
    expect(await confirm(scriptedIO(['y']).io, 'ok?')).toBe(true);
    expect(await confirm(scriptedIO(['Yes']).io, 'ok?')).toBe(true);
    expect(await confirm(scriptedIO(['n']).io, 'ok?')).toBe(false);
    expect(await confirm(scriptedIO(['NO']).io, 'ok?')).toBe(false);
  });

  it('falls back to the default on unrecognized input', async () => {
    expect(await confirm(scriptedIO(['maybe']).io, 'ok?', true)).toBe(true);
    expect(await confirm(scriptedIO(['maybe']).io, 'ok?', false)).toBe(false);
  });
});

/**
 * Composition helpers that give widgets their shared "prefix + hide-when-empty"
 * behavior without repeating it in every render body. A widget's core producer
 * returns the bare value (or null to hide); a wrapper adds the icon/label.
 */
import type { WidgetContext } from './Widget.js';

export type Core<O> = (ctx: WidgetContext, opts: O) => string | null;

/**
 * Wrap a core value with a prefix read from `opts[key]`.
 * `skip-empty` omits the prefix (and separator) when the option is empty,
 * matching icon-style widgets; `always` joins unconditionally, matching
 * label-style widgets (`cache:75%`). A null/empty core value hides the widget.
 */
export function prefixed<O extends Record<string, unknown>>(
  key: string,
  sep: string,
  mode: 'skip-empty' | 'always',
  core: Core<O>,
): Core<O> {
  return (ctx, opts) => {
    const body = core(ctx, opts);
    if (body === null || body === '') {
      return null;
    }
    const raw = opts[key];
    const prefix = typeof raw === 'string' ? raw : '';
    if (mode === 'skip-empty' && prefix === '') {
      return body;
    }
    return `${prefix}${sep}${body}`;
  };
}

export const prefixIcon = <O extends Record<string, unknown>>(
  core: Core<O>,
): Core<O> => prefixed<O>('icon', ' ', 'skip-empty', core);

export const prefixLabel = <O extends Record<string, unknown>>(
  core: Core<O>,
  sep = ':',
): Core<O> => prefixed<O>('label', sep, 'always', core);

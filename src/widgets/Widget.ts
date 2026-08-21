/** Widget descriptor and the context passed to every widget at render time. */
import type { z } from 'zod';
import type { StatusJSON } from '../types/StatusJSON.js';
import type { TranscriptTotals } from '../transcript/parseTranscript.js';
import type { GitChanges } from '../git.js';

export interface WidgetContext {
  status: StatusJSON;
  totals: TranscriptTotals;
  /** Resolved git info (branch + churn resolved once by the pipeline). */
  git: { branch: string | null; changes?: GitChanges | null };
  /** Wall-clock epoch ms, injected so the cache-window countdown is testable. */
  now?: number;
  /** Home directory, injected for powerline path compression. */
  home?: string;
}

/** Deep-partial of the render context — the shape a widget's `sample()` returns. */
export type PartialContext = {
  [K in keyof WidgetContext]?: WidgetContext[K] extends object
    ? Partial<WidgetContext[K]>
    : WidgetContext[K];
};

export interface WidgetDef<O = unknown> {
  type: string;
  /** Zod schema for this widget's options; every field carries a `.default()`. */
  options: z.ZodType<O>;
  /** Produce display text, or `null` to omit the widget. Options are typed + defaulted. */
  render(ctx: WidgetContext, opts: O): string | null;
  /** Deep-partial mock slice merged into the TUI preview context. */
  sample?(): PartialContext;
}

/** Identity factory that infers the options type from the Zod schema. */
export function defineWidget<S extends z.ZodType>(def: {
  type: string;
  options: S;
  render: (ctx: WidgetContext, opts: z.infer<S>) => string | null;
  sample?: () => PartialContext;
}): WidgetDef<z.infer<S>> {
  return def;
}

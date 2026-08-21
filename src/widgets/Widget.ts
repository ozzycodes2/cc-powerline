/** Widget interface and the context passed to every widget at render time. */
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

export interface Widget {
  type: string;
  /** Produce display text, or `null` to omit the widget from the line. */
  render(ctx: WidgetContext, options?: Record<string, unknown>): string | null;
}

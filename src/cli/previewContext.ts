/**
 * The `init` preview's mock render context, DERIVED from the widgets: each
 * widget contributes the slice of {@link WidgetContext} it needs via `sample()`,
 * and those slices are deep-merged onto a small cross-cutting base. Running the
 * real render path over this context means the preview can never drift from
 * production output, and a new widget shows up automatically.
 *
 * Cross-cutting values (`now`, `home`) live in the base; `now`/`cacheExpiresAt`
 * (contributed by cache-window) are chosen to show a stable ~4:43 countdown.
 */
import { ZERO_TOTALS } from '../transcript/parseTranscript.js';
import { WIDGET_DEFS } from '../widgets/registry.js';
import type { PartialContext, WidgetContext, WidgetDef } from '../widgets/Widget.js';

type Obj = Record<string, unknown>;

function isPlainObject(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Recursively merge `patch` onto `base`; objects merge, everything else overwrites. */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch === undefined ? base : (patch as T));
  }
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

function baseContext(): WidgetContext {
  return {
    status: {},
    totals: { ...ZERO_TOTALS },
    git: { branch: null },
    now: 17_000,
    home: '/Users/you',
  };
}

export function previewContext(defs: WidgetDef[] = WIDGET_DEFS): WidgetContext {
  return defs.reduce<WidgetContext>(
    (ctx, d) => deepMerge(ctx, (d.sample?.() ?? {}) as PartialContext),
    baseContext(),
  );
}

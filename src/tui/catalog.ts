/**
 * The picker's view of the widget registry: every widget as a `{type, label,
 * description}` row with the `label ?? type` fallback applied once, so the UI
 * never has to reach into `WidgetDef` or repeat the fallback. Kept separate
 * from `registry.ts` so the render layer stays free of display concerns.
 */
import { WIDGET_DEFS } from '../widgets/registry.js';

export interface WidgetChoice {
  type: string;
  label: string;
  description: string;
}

export const WIDGET_CATALOG: WidgetChoice[] = WIDGET_DEFS.map((w) => ({
  type: w.type,
  label: w.label ?? w.type,
  description: w.description ?? '',
}));

/** Text a fuzzy query matches against: the type and the human label together. */
export function choiceSearchText(choice: WidgetChoice): string {
  return `${choice.type} ${choice.label}`;
}

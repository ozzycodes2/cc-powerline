/**
 * Compose a left and a right rendered group into one status line at a fixed
 * width. Unlike ccstatusline's `FLEX_SENTINEL` placeholder trick (needed
 * because it has a single flex point in a flat widget array), our groups are
 * natively `{left, right}`: render each fully, measure, insert one gap.
 *
 * When the two groups overflow the width, the right group is preserved and the
 * left group is truncated (right-anchored data — cost, context — is the point
 * of the split, so it wins).
 */
import { truncateToWidth } from './stripAnsi.js';
import type { RenderedGroup } from './types.js';

export interface ComposeInput {
  left: RenderedGroup;
  right: RenderedGroup;
  width: number;
}

export function composeLine({ left, right, width }: ComposeInput): string {
  // No right group → a plain left-aligned line (truncated if it overflows).
  if (right.width === 0) {
    return truncateToWidth(left.text, width);
  }

  const gap = width - left.width - right.width;
  if (gap >= 0) {
    return left.text + ' '.repeat(gap) + right.text;
  }

  // Overflow: keep the right group, give the left whatever remains (minus one
  // separating column). If nothing remains, drop the left group entirely.
  const leftBudget = width - right.width - 1;
  if (leftBudget <= 0) {
    return truncateToWidth(right.text, width);
  }
  return `${truncateToWidth(left.text, leftBudget)} ${right.text}`;
}

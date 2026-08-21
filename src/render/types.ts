/**
 * Render-layer data model. Widgets produce `Segment`s; a renderer turns a
 * `LineGroups` (left + right segment arrays) into one ANSI string.
 */

/** A color: a `#rrggbb` hex string, or a basic named ANSI color. */
export type Color =
  | `#${string}`
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite';

/** One rendered widget output: text plus optional foreground/background. */
export interface Segment {
  text: string;
  fg?: Color;
  bg?: Color;
  /** Drop the segment from the line entirely (e.g. a widget with no data). */
  hidden?: boolean;
}

/** The two anchored groups of a status line. */
export interface LineGroups {
  left: Segment[];
  right: Segment[];
}

/** A rendered group: its ANSI string plus the visible (ANSI-stripped) width. */
export interface RenderedGroup {
  text: string;
  width: number;
}

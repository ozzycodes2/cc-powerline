/**
 * User configuration schema. A `Settings` describes the render style and, per
 * line, the left and right widget groups. Parsed with Zod so a malformed
 * config degrades to defaults rather than crashing the statusline.
 */
import { z } from 'zod';

const ColorSchema = z.string();

export const WidgetItemSchema = z.object({
  type: z.string(),
  fg: ColorSchema.optional(),
  bg: ColorSchema.optional(),
  options: z.record(z.unknown()).optional(),
});

export const LineConfigSchema = z.object({
  left: z.array(WidgetItemSchema).default([]),
  right: z.array(WidgetItemSchema).default([]),
});

export const ThemeSchema = z
  .object({
    separator: z.string().optional(),
    rightSeparator: z.string().optional(),
    defaultFg: ColorSchema.optional(),
    defaultBg: ColorSchema.optional(),
  })
  .optional();

export const SettingsSchema = z.object({
  style: z.enum(['powerline', 'builtin']).default('powerline'),
  /** Separator used by the built-in style between segments. */
  separator: z.string().optional(),
  theme: ThemeSchema,
  lines: z.array(LineConfigSchema).default([]),
});

export type WidgetItem = z.infer<typeof WidgetItemSchema>;
export type LineConfig = z.infer<typeof LineConfigSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

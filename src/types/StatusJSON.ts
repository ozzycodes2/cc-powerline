/**
 * Zod schema for Claude Code's statusline stdin contract (verified against
 * code.claude.com/docs/en/statusline). Everything is optional and unknown
 * keys pass through: the statusline must never crash on a missing or newly
 * added field, so parsing is deliberately lenient.
 */
import { z } from 'zod';

// `.catch(undefined)` keeps a single mis-typed field from rejecting the whole
// object — a lenient parse degrades field-by-field, never all-or-nothing.
const num = z.number().optional().catch(undefined);
const str = z.string().optional().catch(undefined);
const bool = z.boolean().optional().catch(undefined);

export const StatusJSONSchema = z
  .object({
    model: z
      .object({ id: str, display_name: str })
      .passthrough()
      .optional(),
    cwd: str,
    workspace: z
      .object({
        project_dir: str,
        current_dir: str,
        git_worktree: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    cost: z
      .object({
        total_cost_usd: num,
        total_duration_ms: num,
        total_api_duration_ms: num,
        total_lines_added: num,
      })
      .passthrough()
      .optional(),
    context_window: z
      .object({
        total_input_tokens: num,
        context_window_size: num,
        used_percentage: num,
        remaining_percentage: num,
        current_usage: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    exceeds_200k_tokens: bool,
    fast_mode: bool,
    effort: z.object({ level: str }).passthrough().optional(),
    thinking: z.object({ enabled: bool }).passthrough().optional(),
    session_id: str,
    session_name: str,
    transcript_path: str,
    version: str,
    output_style: z.object({ name: str }).passthrough().optional(),
    rate_limits: z
      .object({
        five_hour: z
          .object({ used_percentage: num, resets_at: str })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    worktree: z
      .object({ name: str, path: str, branch: str, original_branch: str })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type StatusJSON = z.infer<typeof StatusJSONSchema>;

/** Parse stdin JSON leniently; returns `{}` on any error. Never throws. */
export function parseStatusJSON(input: string): StatusJSON {
  try {
    const json: unknown = JSON.parse(input);
    const result = StatusJSONSchema.safeParse(json);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

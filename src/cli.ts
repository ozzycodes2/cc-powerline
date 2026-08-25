/**
 * `cc-powerline` command-line interface. This is the package's only binary, so
 * it does double duty: with a subcommand it's the human-facing config/pricing
 * tool, and with no subcommand + piped stdin it renders the statusline Claude
 * Code spawns (delegating to `index.ts`, the pure statusline library).
 */
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { isMainEntry } from './isMainEntry.js';
import { main as renderStatusline } from './index.js';
import { saveConfig, settingsPath } from './config/store.js';
import {
  claudeSettingsPath,
  wireStatusLine,
  STATUSLINE_COMMAND,
  type WireResult,
} from './config/claudeSettings.js';
import { confirm, readlineIO, type PromptIO } from './cli/prompts.js';
import { fetchLiteLLMTable, resolvePricing } from './pricing/resolvePricing.js';
import { pricingCachePath, writePricingCache } from './pricing/pricingCache.js';
import {
  buildSettingsFromAnswers,
  renderPreview,
  runInit,
} from './cli/init.js';
import { DEFAULT_PRESET_KEY } from './cli/presets.js';
import { detectTerminalWidth } from './render/terminalWidth.js';
import { WIDGET_TYPES } from './widgets/registry.js';

// Single source of truth for the reported version — a hardcoded string here
// silently drifts from package.json on every release.
const { version: PKG_VERSION } = createRequire(import.meta.url)(
  '../package.json',
) as { version: string };

async function refreshPricing(): Promise<void> {
  const table = await fetchLiteLLMTable();
  if (!table) {
    console.error('cc-powerline: failed to fetch LiteLLM pricing.');
    process.exitCode = 1;
    return;
  }
  await writePricingCache(table, Date.now());
  console.log(
    `Cached ${Object.keys(table).length} models to ${pricingCachePath()}`,
  );
}

/**
 * Render every widget over the shared all-widgets mock context, so the output
 * exercises the full palette regardless of the caller's real config. Uses the
 * same `previewContext()`/`renderPreview` path as `init`, so it can never drift
 * from what the wizard shows or from production output.
 */
function showPreview(opts: { style?: string; width?: number }): void {
  const style = opts.style === 'builtin' ? 'builtin' : 'powerline';
  const settings = buildSettingsFromAnswers({
    style,
    lines: [{ left: WIDGET_TYPES, right: [] }],
    preset: DEFAULT_PRESET_KEY,
  });
  const width =
    opts.width && opts.width > 0 ? opts.width : detectTerminalWidth();
  console.log(renderPreview(settings, width));
}

/** The manual wiring snippet, shown when auto-wiring is declined or fails. */
function manualWiringHint(): string {
  return [
    `Add this to ${claudeSettingsPath()} yourself:`,
    `  "statusLine": { "type": "command", "command": "${STATUSLINE_COMMAND}" }`,
  ].join('\n');
}

export interface WireCliDeps {
  /** Whether to prompt; defaults to a real (TTY) terminal on both streams. */
  interactive?: boolean;
  io?: PromptIO;
  wire?: () => Promise<WireResult>;
  log?: (message: string) => void;
}

/**
 * Add cc-powerline's `statusLine` hook to Claude Code's settings after a config
 * save, so `init` wires itself in instead of pointing the user at the README.
 * Prompts (default yes) on a real terminal and auto-confirms when piped, so a
 * CI / scripted `init` still wires up. A settings file we can't parse is
 * reported with the manual snippet, never clobbered.
 */
export async function wireIntoClaudeCode(deps: WireCliDeps = {}): Promise<void> {
  const interactive =
    deps.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const log = deps.log ?? ((m: string) => console.log(m));
  const wire = deps.wire ?? (() => wireStatusLine());

  if (interactive) {
    const io = deps.io ?? readlineIO();
    try {
      const ok = await confirm(
        io,
        'Wire cc-powerline into Claude Code (statusLine hook)?',
        true,
      );
      if (!ok) {
        log(manualWiringHint());
        return;
      }
    } finally {
      io.close();
    }
  }

  try {
    const res = await wire();
    if (res.outcome === 'unchanged') {
      log(`Claude Code already renders cc-powerline (${res.path}).`);
    } else if (res.previousCommand !== undefined) {
      log(
        `Wired cc-powerline into Claude Code (${res.path}); ` +
          `replaced statusLine command "${res.previousCommand}".`,
      );
    } else {
      log(`Wired cc-powerline into Claude Code (${res.path}).`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log(`Could not update Claude Code settings: ${reason}.`);
    log(manualWiringHint());
  }
}

/**
 * Open the interactive config editor. Uses the rich Ink TUI when attached to a
 * real terminal, and falls back to the plain readline wizard for piped / CI
 * runs or when `--no-tui` is passed. Ink (and React) are pulled in via a lazy
 * import so they never load on the non-interactive path or the hot statusline
 * entry.
 *
 * Whichever path runs, a successful save is followed by the Claude Code wiring
 * step; the TUI can be quit without saving, so its save is tracked to avoid
 * wiring on a no-op edit.
 */
async function runConfigUi(opts: { tui?: boolean }): Promise<void> {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  let saved = false;
  if (opts.tui !== false && interactive) {
    const { runTui } = await import('./tui/run.js');
    await runTui({
      save: async (s) => {
        await saveConfig(s);
        saved = true;
      },
    });
  } else {
    await runInit();
    saved = true;
  }
  if (saved) {
    await wireIntoClaudeCode();
  }
}

async function showPricing(opts: { model?: string }): Promise<void> {
  const { table, source } = await resolvePricing();
  if (!opts.model) {
    console.log(`source: ${source}`);
    console.log(`models: ${Object.keys(table).length}`);
    return;
  }
  const pricing = table[opts.model];
  if (!pricing) {
    console.error(
      `cc-powerline: no pricing for "${opts.model}" (source: ${source}).`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(pricing, null, 2));
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('cc-powerline')
    .description(
      'A precise-cost, powerline-capable statusline for Claude Code.',
    )
    .version(PKG_VERSION);

  program
    .command('init')
    .description('Create or edit your configuration interactively.')
    .option(
      '--no-tui',
      'use the plain readline wizard instead of the interactive TUI',
    )
    .action(async (opts: { tui?: boolean }) => {
      await runConfigUi(opts);
    });

  program
    .command('preview')
    .description('Render every widget over sample data (no config required).')
    .option(
      '--style <style>',
      'render style: powerline or builtin',
      'powerline',
    )
    .option('--width <cols>', 'render width in columns', (v) =>
      Number.parseInt(v, 10),
    )
    .action((opts: { style?: string; width?: number }) => showPreview(opts));

  const config = program
    .command('config')
    .description('Configuration file helpers.');
  config
    .command('path')
    .description('Print the settings file path.')
    .action(() => console.log(settingsPath()));
  config
    .command('edit')
    .description('Edit the configuration in the interactive editor.')
    .option(
      '--no-tui',
      'use the plain readline wizard instead of the interactive TUI',
    )
    .action(async (opts: { tui?: boolean }) => {
      await runConfigUi(opts);
    });

  const pricing = program
    .command('pricing')
    .description('Pricing cache control.');
  pricing
    .command('refresh')
    .description('Fetch the latest LiteLLM pricing and cache it.')
    .action(refreshPricing);
  pricing
    .command('show')
    .description("Show the resolved pricing source, or one model's rates.")
    .option('--model <name>', 'model name to show rates for')
    .action(showPricing);

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  const rest = argv.slice(2);
  // No subcommand + a piped (non-TTY) stdin is how Claude Code invokes us for
  // the statusline: read the status JSON, render, exit — never touch commander.
  if (rest.length === 0 && !process.stdin.isTTY) {
    await renderStatusline();
    return;
  }
  const program = buildProgram();
  // Bare interactive `cc-powerline` (a human, no args): show help rather than
  // block forever waiting on stdin.
  if (rest.length === 0) {
    program.outputHelp();
    return;
  }
  await program.parseAsync(argv);
}

if (isMainEntry(process.argv[1], import.meta.url)) {
  void main();
}

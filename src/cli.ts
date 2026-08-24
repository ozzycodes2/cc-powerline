/**
 * `cc-powerline` command-line interface: config management and pricing cache
 * control. The statusline itself is `index.ts` (run by Claude Code); this is
 * the human-facing entry point.
 */
import { Command } from 'commander';
import { settingsPath } from './config/loadSettings.js';
import {
  fetchLiteLLMTable,
  resolvePricing,
} from './pricing/resolvePricing.js';
import { pricingCachePath, writePricingCache } from './pricing/pricingCache.js';
import { buildSettingsFromAnswers, renderPreview, runInit } from './cli/init.js';
import { DEFAULT_PRESET_KEY } from './cli/presets.js';
import { detectTerminalWidth } from './render/terminalWidth.js';
import { WIDGET_TYPES } from './widgets/registry.js';

/* eslint-disable no-console */

async function refreshPricing(): Promise<void> {
  const table = await fetchLiteLLMTable();
  if (!table) {
    console.error('cc-powerline: failed to fetch LiteLLM pricing.');
    process.exitCode = 1;
    return;
  }
  await writePricingCache(table, Date.now());
  console.log(`Cached ${Object.keys(table).length} models to ${pricingCachePath()}`);
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
    left: WIDGET_TYPES,
    right: [],
    preset: DEFAULT_PRESET_KEY,
  });
  const width = opts.width && opts.width > 0 ? opts.width : detectTerminalWidth();
  console.log(renderPreview(settings, width));
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
    console.error(`cc-powerline: no pricing for "${opts.model}" (source: ${source}).`);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(pricing, null, 2));
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('cc-powerline')
    .description('A precise-cost, powerline-capable statusline for Claude Code.')
    .version('0.1.0');

  program
    .command('init')
    .description('Create a configuration interactively.')
    .action(async () => {
      await runInit();
    });

  program
    .command('preview')
    .description('Render every widget over sample data (no config required).')
    .option('--style <style>', 'render style: powerline or builtin', 'powerline')
    .option('--width <cols>', 'render width in columns', (v) => Number.parseInt(v, 10))
    .action((opts: { style?: string; width?: number }) => showPreview(opts));

  const config = program.command('config').description('Configuration file helpers.');
  config
    .command('path')
    .description('Print the settings file path.')
    .action(() => console.log(settingsPath()));

  const pricing = program.command('pricing').description('Pricing cache control.');
  pricing
    .command('refresh')
    .description('Fetch the latest LiteLLM pricing and cache it.')
    .action(refreshPricing);
  pricing
    .command('show')
    .description('Show the resolved pricing source, or one model\'s rates.')
    .option('--model <name>', 'model name to show rates for')
    .action(showPricing);

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  await buildProgram().parseAsync(argv);
}

const invokedPath = process.argv[1] ?? '';
if (invokedPath.endsWith('cli.js') || invokedPath.endsWith('cli.ts')) {
  void main();
}

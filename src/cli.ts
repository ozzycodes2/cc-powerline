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
import { runInit } from './cli/init.js';

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

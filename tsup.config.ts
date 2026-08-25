import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  target: 'node18',
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: false,
  // React and Ink (and Ink's yoga/wasm layout deps) ship as ESM and are
  // fragile to bundle into a shebang'd single file, so keep them as runtime
  // dependencies and let Node resolve them from node_modules. The CLI only
  // pulls them in via a lazy import() when the interactive TUI actually runs.
  external: ['react', 'ink'],
  // The statusline entry and the CLI are both executed directly by Node
  // (Claude Code spawns `index.js`; users run `cc-powerline`), so both need
  // a shebang. tsup rewrites it into every entry file.
  banner: {
    js: '#!/usr/bin/env node',
  },
});

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
  // Emit type declarations for the library entry only. The CLI is an
  // executable, not an import target, so it needs no `.d.ts`.
  dts: { entry: { index: 'src/index.ts' } },
  // React and Ink (and Ink's yoga/wasm layout deps) ship as ESM and are
  // fragile to bundle into a shebang'd single file, so keep them as runtime
  // dependencies and let Node resolve them from node_modules. The CLI only
  // pulls them in via a lazy import() when the interactive TUI actually runs.
  external: ['react', 'ink'],
  // `cli.js` is the package's only binary (both `cc-powerline <cmd>` and the
  // Claude Code statusline go through it), so it needs a shebang. `index.js` is
  // the importable library; the shebang there is harmless. tsup rewrites it
  // into every entry file, so both get one.
  banner: {
    js: '#!/usr/bin/env node',
  },
});

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
  // The statusline entry and the CLI are both executed directly by Node
  // (Claude Code spawns `index.js`; users run `cc-powerline`), so both need
  // a shebang. tsup rewrites it into every entry file.
  banner: {
    js: '#!/usr/bin/env node',
  },
});

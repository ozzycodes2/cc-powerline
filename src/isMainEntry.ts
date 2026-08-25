import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Whether this module is the process entry point (run directly) rather than
 * imported by another module (e.g. a test).
 *
 * `argv[1]` is compared against the module's own path via `realpathSync` on both
 * sides. npm exposes a bin as a symlink named after the command, so a naive
 * `argv[1].endsWith('cli.js')` check misses every install-based invocation and
 * `main()` never runs. Resolving the symlink is what makes the check hold for
 * global installs, `npx`, and direct `node dist/cli.js` alike.
 *
 * @param argv1 typically `process.argv[1]` (undefined when absent)
 * @param moduleUrl the caller's `import.meta.url`
 */
export function isMainEntry(
  argv1: string | undefined,
  moduleUrl: string,
): boolean {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

# Contributing

Thanks for helping improve cc-powerline. Bug reports, ideas, and pull requests
are all welcome.

## Reporting bugs and requesting features

Open an [issue](https://github.com/ozzycodes2/cc-powerline/issues). For a bug,
include your OS, Node version (`node -v`), the cc-powerline version, and the
config or stdin JSON that reproduces it. For a suspected **security**
vulnerability, follow [SECURITY.md](SECURITY.md) instead of opening a public
issue.

## Development

Setup, the test/typecheck/build commands, and how to regenerate the golden
snapshots and README media all live in the **Develop** section of the
[README](README.md#develop). In short:

```bash
npm install
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # tsup → dist/
```

A Husky pre-commit hook runs `lint-staged` (Prettier) on staged files, so
formatting is applied for you on commit.

## Pull requests

- Branch off `main` and keep each PR focused on one change.
- Add or update tests for any behavior you change; the CI gate runs
  `typecheck`, `coverage`, and `build` on Node 18, 20, and 22, plus `lint` and
  `prettier --check`. Match the existing test framework and layout.
- Write clear commit messages: a conventional-commit prefix (`feat:`, `fix:`,
  `chore:`, …) and an imperative headline, with a short body explaining _why_
  for anything non-obvious.
- Update `README.md` when you change user-facing behavior, and add a
  `CHANGELOG.md` entry under a new version heading.

## Releasing

Releases publish to npm from CI via a GitHub Release; the full process is in the
[README's Publishing section](README.md#publishing). Only maintainers cut
releases.

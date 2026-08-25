import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // The statusline is spawned by Claude Code and must never crash; unused
      // vars prefixed with `_` are intentional (e.g. discarded catch bindings).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'error',
      // This tool's whole job is parsing and emitting ANSI/SGR escapes, so
      // control characters in regexes are intentional throughout.
      'no-control-regex': 'off',
    },
  },
  // Ink renders React to the terminal; enable the React rule sets for JSX.
  {
    files: ['src/tui/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs['recommended-latest'].rules,
      // Ink is not react-dom; the runtime JSX transform needs no React import.
      'react/react-in-jsx-scope': 'off',
    },
  },
  // CLI surfaces are the human-facing entry points and legitimately write to
  // stdout/stderr.
  {
    files: ['src/cli.ts', 'src/cli/**/*.ts', 'scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  // Tests exercise internals and use loose typing freely.
  {
    files: ['test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  prettier,
);

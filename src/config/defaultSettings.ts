/**
 * The default configuration: a single powerline line with a sensible split,
 * painted from the `fabric` preset.
 */
import type { Settings } from '../types/Settings.js';

export const DEFAULT_SETTINGS: Settings = {
  style: 'powerline',
  lines: [
    {
      left: [
        { type: 'model', fg: '#000000', bg: '#6f93c0' },
        { type: 'git-branch', fg: '#171717', bg: '#6aaea6' },
        { type: 'directory', fg: '#1b1b1b', bg: '#8db05a' },
      ],
      right: [
        { type: 'context-length', fg: '#000000', bg: '#6f93c0' },
        { type: 'cache-hit-rate', fg: '#171717', bg: '#6aaea6' },
        { type: 'session-cost', fg: '#1b1b1b', bg: '#8db05a' },
      ],
    },
  ],
};

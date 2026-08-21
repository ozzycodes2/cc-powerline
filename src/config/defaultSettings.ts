/** The default configuration: a single powerline line with a sensible split. */
import type { Settings } from '../types/Settings.js';

export const DEFAULT_SETTINGS: Settings = {
  style: 'powerline',
  lines: [
    {
      left: [
        { type: 'model', fg: 'brightWhite', bg: '#2d3142' },
        { type: 'git-branch', fg: 'brightWhite', bg: '#4f5d75' },
        { type: 'directory', fg: 'brightWhite', bg: '#3d5a80' },
      ],
      right: [
        { type: 'context-length', fg: 'brightWhite', bg: '#5c6b73' },
        { type: 'cache-hit-rate', fg: 'brightWhite', bg: '#6d597a' },
        { type: 'session-cost', fg: 'black', bg: '#2a9d8f' },
      ],
    },
  ],
};

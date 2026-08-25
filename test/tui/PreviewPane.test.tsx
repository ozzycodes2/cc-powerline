/**
 * The preview renders the production status line inside a bordered, padded box.
 * It must render to the box *interior* width, not the full terminal width —
 * otherwise the line overflows and Ink wraps it, bleeding a segment background
 * onto the next visual row. We assert buildStatus is asked for the interior
 * width (terminal minus the border + paddingX chrome), and clamps at 1.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { createElement } from 'react';
import { stripAnsi } from '../../src/render/stripAnsi.js';
import type { Settings } from '../../src/types/Settings.js';

const buildStatusMock = vi.fn((..._args: unknown[]) => 'PREVIEW');
vi.mock('../../src/pipeline.js', () => ({ buildStatus: buildStatusMock }));

const { PreviewPane } = await import('../../src/tui/PreviewPane.js');

const SETTINGS: Settings = {
  style: 'powerline',
  lines: [{ left: [{ type: 'model' }], right: [] }],
};

const widthArg = () => buildStatusMock.mock.calls[0]![2] as number;

beforeEach(() => buildStatusMock.mockClear());

describe('PreviewPane', () => {
  it('renders to the interior width (full width minus border + padding)', () => {
    render(createElement(PreviewPane, { settings: SETTINGS, width: 80 }));
    expect(widthArg()).toBe(76); // 80 - 2 border - 2 padding
  });

  it('never asks for a width below 1', () => {
    render(createElement(PreviewPane, { settings: SETTINGS, width: 2 }));
    expect(widthArg()).toBe(1);
  });

  it('renders the sample-data caption and the built line', () => {
    const { lastFrame } = render(
      createElement(PreviewPane, { settings: SETTINGS, width: 80 }),
    );
    const frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('live preview');
    expect(frame).toContain('PREVIEW');
  });
});

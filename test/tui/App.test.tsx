/**
 * Thin wiring tests for the Ink shell. Settings logic is covered exhaustively
 * by the pure reducer tests; here we only prove the components are wired to it:
 * the preview renders, the menu navigates, sub-screens open and close, and
 * save reaches the injected persist function.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { createElement } from 'react';
import { App } from '../../src/tui/App.js';
import { stripAnsi } from '../../src/render/stripAnsi.js';
import { DEFAULT_SETTINGS } from '../../src/config/defaultSettings.js';

// Raw terminal input sequences ink parses into key events.
const KEY = {
  down: '[B',
  up: '[A',
  enter: '\r',
  esc: '',
  ctrlS: '',
};
const delay = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const mount = (save = vi.fn().mockResolvedValue(undefined)) => {
  const app = render(
    createElement(App, {
      initialSettings: DEFAULT_SETTINGS,
      sourcePath: '/tmp/s.json',
      save,
      width: 80,
    }),
  );
  return { ...app, save };
};

describe('App shell', () => {
  it('renders the live preview and the main menu', () => {
    const { lastFrame } = mount();
    const frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('live preview');
    expect(frame).toContain('Lines & widgets');
    expect(frame).toContain('Save');
    expect(frame).toContain('saved');
  });

  it('moves the menu cursor with the arrow keys', async () => {
    const { lastFrame, stdin } = mount();
    await delay(); // let Ink subscribe to stdin before the first keypress
    stdin.write(KEY.down);
    await delay();
    // Cursor started on "Lines & widgets"; one step down marks "Style".
    expect(stripAnsi(lastFrame() ?? '')).toMatch(/❯\s+Style/);
  });

  it('opens a sub-screen on enter and returns on escape', async () => {
    const { lastFrame, stdin } = mount();
    await delay();
    // Step down to "Import / export" and open it.
    stdin.write(KEY.down);
    await delay();
    stdin.write(KEY.down);
    await delay();
    stdin.write(KEY.down);
    await delay();
    stdin.write(KEY.enter);
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('Import / export');
    stdin.write(KEY.esc);
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('Lines & widgets');
  });

  it('toggles the help overlay with "?" and dismisses on any key', async () => {
    const { lastFrame, stdin } = mount();
    await delay();
    stdin.write('?');
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('Keyboard help');
    stdin.write(KEY.esc);
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).not.toContain('Keyboard help');
  });

  it('saves through the injected persist function on ^S', async () => {
    const { stdin, save } = mount();
    await delay();
    stdin.write(KEY.ctrlS);
    await delay();
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });

  it('drills into the widget editor, deletes a widget, and confirms quit-when-dirty', async () => {
    const { lastFrame, stdin, save } = mount();
    await delay();
    stdin.write(KEY.enter); // "Lines & widgets" -> LineList
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('Line 1');
    stdin.write(KEY.enter); // drill into Line 1's widgets
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('widgets');
    stdin.write('d'); // remove the focused widget -> dirty
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('unsaved');

    stdin.write('q'); // dirty: first quit asks for confirmation, does not exit
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('Unsaved changes');
    expect(save).not.toHaveBeenCalled();
  });

  it('cancels a pending quit confirmation on any other key', async () => {
    const { lastFrame, stdin } = mount();
    await delay();
    stdin.write(KEY.enter); // LineList
    await delay();
    stdin.write(KEY.enter); // WidgetList
    await delay();
    stdin.write('d'); // dirty
    await delay();
    stdin.write('q'); // ask to confirm
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('Unsaved changes');
    stdin.write(KEY.up); // any other key cancels
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).not.toContain('Unsaved changes');
  });

  it('routes to the Style and Theme panels from the menu', async () => {
    const { lastFrame, stdin } = mount();
    await delay();
    stdin.write(KEY.down); // "Style"
    await delay();
    stdin.write(KEY.enter);
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('powerline');
    stdin.write(KEY.esc);
    await delay();
    stdin.write(KEY.down); // "Style"
    await delay();
    stdin.write(KEY.down); // "Theme"
    await delay();
    stdin.write(KEY.enter);
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('recolors');
  });

  it('opens the color picker for a focused widget', async () => {
    const { lastFrame, stdin } = mount();
    await delay();
    stdin.write(KEY.enter); // LineList
    await delay();
    stdin.write(KEY.enter); // WidgetList
    await delay();
    stdin.write('c'); // edit color of the focused widget
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toMatch(/fg|bg/);
  });

  it('adds a widget through the picker', async () => {
    const { lastFrame, stdin } = mount();
    await delay();
    stdin.write(KEY.enter); // LineList
    await delay();
    stdin.write(KEY.enter); // WidgetList
    await delay();
    stdin.write('a'); // open picker
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('Add widget');
    stdin.write(KEY.enter); // pick the first type (model)
    await delay();
    expect(stripAnsi(lastFrame() ?? '')).toContain('unsaved');
  });
});

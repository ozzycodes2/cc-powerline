/**
 * Split compound SGR escapes into one escape per attribute.
 *
 * The powerline renderer emits packed sequences like
 * `\x1b[38;2;79;93;117;48;2;61;90;128m` (foreground *and* background in a single
 * escape). That is valid ANSI, but some consumers track styles per attribute and
 * only register the *first* attribute of a packed escape — so they never learn a
 * background was opened and never close it. (Ink's preview text engine is the
 * concrete case: the unclosed background bleeds across the box and down the
 * screen at wide widths.) Rewriting each attribute into its own `\x1b[..m` is
 * visually identical on a real terminal but hands such a consumer a
 * background-open it can actually close.
 *
 * Only the SGR family (`\x1b[..m`) is touched; other escapes pass through.
 */
const SGR = /\x1b\[([0-9;]*)m/g;

/** Consume one SGR attribute starting at `i`, returning [attr, nextIndex]. */
function takeAttr(params: string[], i: number): [string, number] {
  const p = params[i];
  // Extended color: `38;2;r;g;b` / `48;2;r;g;b` (truecolor) or `38;5;n` / `48;5;n`.
  if ((p === '38' || p === '48') && params[i + 1] === '2') {
    return [params.slice(i, i + 5).join(';'), i + 5];
  }
  if ((p === '38' || p === '48') && params[i + 1] === '5') {
    return [params.slice(i, i + 3).join(';'), i + 3];
  }
  return [p!, i + 1];
}

export function expandSgr(input: string): string {
  return input.replace(SGR, (_whole, body: string) => {
    // `\x1b[m` and `\x1b[0m` are already single resets; leave them be.
    if (body === '' || body === '0') return `\x1b[${body}m`;
    const params = body.split(';');
    let out = '';
    for (let i = 0; i < params.length; ) {
      const [attr, next] = takeAttr(params, i);
      out += `\x1b[${attr}m`;
      i = next;
    }
    return out;
  });
}

# Security Policy

## Supported versions

cc-powerline ships as a single line of releases; only the latest published
version on npm receives security fixes. Upgrade to the newest
`@ozzycodes2/cc-powerline` before reporting an issue if you can.

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** — do not open a public
issue for anything exploitable.

Use GitHub's private reporting:
[**Report a vulnerability**](https://github.com/ozzycodes2/cc-powerline/security/advisories/new).
This opens a private advisory visible only to the maintainers.

Include enough to reproduce: the version, your OS and Node version, the
statusline input or config that triggers it, and the observed vs. expected
behavior. A minimal repro (e.g. a directory name or a `settings.json`) helps
most.

You can expect an acknowledgement within a few days. Once a fix is available it
will be released to npm and the advisory published with credit to the reporter
unless you ask to remain anonymous.

## Threat model

cc-powerline runs locally as the `statusLine` command Claude Code spawns. It
reads session JSON on stdin, reads its own config and cached pricing from disk,
shells out to `git`/`stty`/`tput` to probe the environment, and fetches the
public LiteLLM price table over HTTPS. Input it treats as untrusted includes the
stdin JSON (notably `cwd`, which reflects a possibly attacker-named directory)
and the on-disk config. External commands are invoked via `execFile` with an
argv array, never through a shell, so path and environment values cannot be
interpreted as shell syntax.

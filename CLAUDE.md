# claude-mods

Josh's Claude Code mods (plugins built on function hooks), one per folder under `plugins/`, published together as one marketplace (`.claude-plugin/marketplace.json`). Each plugin's `README.md` is the source of truth for its behaviour; root `package.json` scripts for commands, which run across every plugin. A plugin with its own `CLAUDE.md` has rules beyond these: read it before working in that folder.

## One set, one version

The plugins are versioned together. A release bumps `version` in every `plugins/*/.claude-plugin/plugin.json`, `metadata.version` in the marketplace file and `version` in `package.json` to the same value, then tags `v<version>`. Installs from GitHub only see a change after a version bump; this machine reads the plugins straight from this folder (see `README.md`), so `/reload-plugins` picks up an edit without one.

A new plugin gets a folder under `plugins/`, an entry in the marketplace file, a row in the root `README.md` table, and a showcase: a scenario in `scripts/showcase/scenarios.ts` and its image (`pnpm showcase <mod>`) under the README's title. A change to what a mod shows on screen means regenerating its image.

## The API has no docs

Function hooks are early access. Read these instead of guessing:

- **Type declarations**: `plugins/<name>/.claude-plugin/types/claude-code/index.d.ts`, written by Claude Code when an interactive session hot-loads the plugin from a folder (`claude --plugin-dir plugins/<name>`); a `-p` run and an ordinary install write nothing. Not in git. It matches the installed binary, and its JSDoc is the real documentation: grep it for an event (`'turn.complete'`), a noun (`prompt: {`), or the test kit (`declare module 'claude-code/testing'`). `pnpm typecheck` needs it in every plugin.
- **Official mods**: https://github.com/anthropics/claude-code/tree/main/mods. `agents-md` is the closest model for module layout and in-memory `fs` tests; `sec-default` explains tiers.
- **Sibling plugins**: look in `plugins/` for a pattern before inventing one.

## Rules the validator and engine enforce

Each of these cost a debugging round to find:

- **`$` stays in the hooks module** (`hooks/register.ts[x]`). `claude plugin validate` follows `$` only into functions declared in the same file, never across an import. Pure logic may move to its own modules.
- **One hook per event per plugin**, tests included. Where a plugin has a test fixture answering engine calls (`tests/fixtures/`), extend it instead of registering those events again.
- **A failing hook is skipped silently**, so a test asserting "nothing changed" also passes when the hook throws. A failing test prints `the engine reported:` with each skipped hook; when a change "does nothing" in a session, read the debug log (`claude --debug-file <path>`) before the code.
- **`claude plugin validate .` at the root checks the marketplace file**; `pnpm validate` also checks each plugin.

## Verifying against the real binary

Tests prove the logic; confirm engine behaviour in a live session with `--plugin-dir plugins/<name>` and `--debug-file`. These plugins are installed on this machine, so a `--plugin-dir` run loads the plugin twice: run the probe from a temp folder with that plugin disabled, or rely on the installed copy alone.

## Skills

- `mattpocock-skills:tdd` for behaviour changes.
- `mattpocock-skills:diagnosing-bugs` when a hook doesn't fire or does nothing.
- `mattpocock-skills:writing-for-agents` before editing any `CLAUDE.md` here.

# skill-augment

A `skill.prompt` hook that adds augmentation markdown to skill prompts. `README.md` is the source of truth for behaviour and file format; the root `CLAUDE.md` holds the rules every plugin here shares.

## Rules and gotchas

- Anything that calls `$` lives in `hooks/register.ts`; `hooks/parse.ts` and `hooks/references.ts` are pure.
- `tests/fixtures/workspace-of.ts` already answers `fs.stat`, `fs.list`, `fs.read`, `ui.log`, `session.root`, `skill.prompt` and env (via `mock.env`). Behaviour changes go tests first, against `workspaceOf`.
- **`$.env.get` takes string literals only**; the validator lists the names it finds.
- **A test's `$` has no `env` noun.** Set env with `mock.env(on, …)`.
- **Fixture paths avoid `/home`**: on macOS it's an automount, and the engine refuses it as a network location.
- **Hook budget is 10s** per dispatch; past it the skill loads unaugmented.
- On a Team or Enterprise org, the built-in `sec-default` forwards `skill.prompt` past user-tier plugins, so the hook never fires. The debug log says `sec-default@builtin seated outermost`; the fix is managed `prependPlugins` (see README Requirements).
- Hooks modules load only after workspace trust is accepted; `-p` runs imply trust.
- Skill names arrive qualified: `plugin:skill` for a plugin's skill.
- `$.ui.log` draws every line the same dim style, with no styling control.

## Verifying against the real binary

1. Make a temp project with `.claude/skills-augment/<file>.md` targeting a real skill (leave `~/.claude` alone).
2. From it, run `claude -p --model haiku --debug-file /tmp/probe.log "/<plugin>:<skill> test"` (the installed plugin reads this folder).
3. Evidence is the debug log (`rg '\[skill-augment\]' /tmp/probe.log`, plus `hooks module skill-augment… loaded`) and the session transcript under `~/.claude/projects/<project-dir>/*.jsonl` showing the delivered text. The model's reply alone proves nothing: it can ignore delivered text that conflicts with the skill.

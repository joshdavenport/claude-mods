# skill-prompt-view

A Claude Code mod that shows every skill's expanded prompt inline in the transcript.

When a skill runs, typed as `/name` or called by the model through the Skill tool, Claude Code hides the prompt it sends the model; the transcript shows only the command line. This mod adds a row under it holding the prompt as the model received it, after `!` shell blocks ran and after any other plugin's rewrite, drawn as markdown. Each row starts folded to one line; Show expands it, Hide folds it again.

Display only: the model never reads the row, and `--resume` doesn't bring rows back.

## Install

```
/plugin install skill-prompt-view --marketplace joshdavenport/claude-mods
```

See the [repository README](../../README.md#install) for installing every mod, or from a local checkout.

## Develop

Run `pnpm test` and `pnpm lint` from the repository root; see its [README](../../README.md#develop).

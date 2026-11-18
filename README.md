# claude-mods

A set of [Claude Code](https://claude.com/claude-code) mods: plugins built on function hooks that change how Claude Code looks and behaves. They live in one marketplace and share one version.

| Mod                                            | What it does                                                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [clarity](plugins/clarity)                     | Draws assistant replies with its own markdown renderer (status pills, label icons, underlined headings) and teaches the model a reply vocabulary to match. |
| [grill-q-prompt](plugins/grill-q-prompt)       | When a reply asks a grilling round of numbered `❓ Q1`, `❓ Q2` questions, fills the empty prompt box with a `q1. `, `q2. ` answer template.               |
| [md-glow](plugins/md-glow)                     | Offers each markdown file written in the session for viewing in a pane, rendered by the local `glow` CLI.                                                  |
| [skill-augment](plugins/skill-augment)         | Adds your own markdown to the prompts of skills you can't edit, such as those shipped in plugins.                                                          |
| [skill-prompt-view](plugins/skill-prompt-view) | Shows each skill's expanded prompt inline in the transcript, as the model received it.                                                                     |

## Install

Add the marketplace once, then install the mods you want. At the prompt of a terminal session:

```
/plugin marketplace add joshdavenport/claude-mods
/plugin install clarity@joshdavenport-mods
```

Or from a shell, all of them:

```sh
claude plugin marketplace add joshdavenport/claude-mods
for mod in clarity grill-q-prompt md-glow skill-augment skill-prompt-view; do
  claude plugin install "$mod@joshdavenport-mods"
done
```

`claude plugin marketplace update joshdavenport-mods`, then `claude plugin update <mod>@joshdavenport-mods`, picks up a new release.

Hooks modules load only in a workspace whose trust dialog has been accepted. Each mod's README lists anything else it needs (clarity wants a Nerd Font, md-glow wants `glow` on your machine).

### From a local checkout

To work on the mods, add the checkout itself as the marketplace instead of the GitHub repo:

```sh
git clone git@github.com:joshdavenport/claude-mods.git ~/Projects/claude-mods
claude plugin marketplace add ~/Projects/claude-mods
for mod in clarity grill-q-prompt md-glow skill-augment skill-prompt-view; do
  claude plugin install "$mod@joshdavenport-mods"
done
```

Each mod is then read straight from `plugins/<mod>`: edit a file and run `/reload-plugins`, with no reinstall or version bump. Both sources register the marketplace as `joshdavenport-mods`, so use one or the other; `claude plugin marketplace remove joshdavenport-mods` clears the current one.

## Develop

```sh
pnpm install
pnpm test        # claude plugin test, for every mod
pnpm lint        # oxfmt check, oxlint, typecheck, claude plugin validate
pnpm format      # oxfmt
```

`pnpm typecheck` needs `plugins/<mod>/.claude-plugin/types/`, which Claude Code writes when an interactive `claude --plugin-dir plugins/<mod>` session loads the mod. `CLAUDE.md` has the rules the engine and validator enforce, and how releases are versioned.

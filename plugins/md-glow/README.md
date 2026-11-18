# md-glow

A Claude Code mod that shows markdown files written in the session in a pane, rendered by [glow](https://github.com/charmbracelet/glow).

- **Offer:** when a Write creates or rewrites a `.md` file, a row above the prompt names it, with View with glow and Dismiss buttons. It stays until dismissed or replaced by the next one.
- **Pane:** shows the chosen file as glow renders it, fitted to the pane's width up to a readable maximum, and redraws when the file is written again.
- **`/glow [path]`:** opens the pane on `path`, or on the latest markdown file written this session.

## Install

```
/plugin install md-glow --marketplace joshdavenport/claude-mods
```

See the [repository README](../../README.md#install) for installing every mod, or from a local checkout.

## Needs

- `glow` installed (`brew install glow`).

## Develop

Run `pnpm test` and `pnpm lint` from the repository root; see its [README](../../README.md#develop).

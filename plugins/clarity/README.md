# clarity

A Claude Code mod that draws assistant replies with its own markdown renderer, so their look is ours to change.

- **Pills:** `[[Done]]`, `[[Failed]]`, `[[Needs you]]` and the rest draw as rounded, coloured chips with an icon from their word.
- **Headings:** every level in one colour, told apart by the line under it: `=` for h1, `-` for h2, `·` for h3, a spaced grey `· · ·` for h4, and none below that.
- **Labels:** bold lead labels such as **Cause:** and **Next:** take an icon, and a heading takes the icon of its first word ("How it works" gets How's).
- **Marks:** `✓`, `✗`, `→` and `├──` tree lines are coloured.
- **Reply rules:** a section added to the system prompt teaches the model the pill words and labels, and to close every reply with a "What I need from you" section. Runs where nothing draws (print, SDK) don't get it.

Only the display changes: the stored message keeps its markdown (ctrl+o shows it).

The vocabulary, icons and reply rules come from [pi-emphasis](https://github.com/johnlindquist/pi-emphasis) by John Lindquist (MIT, see `hooks/pi-emphasis.LICENSE`).

## Install

```
/plugin install clarity --marketplace joshdavenport/claude-mods
```

See the [repository README](../../README.md#install) for installing every mod, or from a local checkout.

## Needs

- A terminal font with [Nerd Font](https://www.nerdfonts.com/) symbols, for the icons and rounded pill ends.
- A dark terminal theme: the palette is raw colours sampled from pi-emphasis on Pi's dark theme.

## How it works

- `hooks/register.tsx` hooks `ui.render` for `AssistantMessage` and `prompt.compose`.
- `hooks/markdown.tsx` lexes the reply with [marked](https://marked.js.org) (vendored in `hooks/vendor/`, since a mod can only import its own files) and turns the tokens into `Box`, `Text`, `Link` and `Code` elements. Every colour and glyph is in its `STYLE` table.
- Tables, blockquotes and HTML go back to the built-in renderer as a `<Markdown>` of their raw text, with any pills in them shown as plain words.
- `hooks/vocabulary.ts` holds the pill words, icons and the reply rules, which read their word lists from the same tables.

To update marked, copy `lib/marked.esm.js` and `lib/marked.d.ts` from the npm package over `hooks/vendor/marked.js` and `hooks/vendor/marked.d.ts`.

## Develop

Run `pnpm test` and `pnpm lint` from the repository root; see its [README](../../README.md#develop).

## Limits

- No light-theme palette: the mod can't read whether the Claude Code theme is light or dark.
- Link text drew dark blue in a screen capture despite the palette's colour on it; not yet checked in a live terminal.
- Tables and blockquotes use the built-in renderer.

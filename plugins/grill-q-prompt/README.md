# grill-q-prompt

A Claude Code mod for answering grilling rounds. When a reply asks numbered
questions, the empty prompt box fills with a line per question, ready to
answer in:

```
q1.
q2.
q3.
```

## Install

```
/plugin install grill-q-prompt --marketplace joshdavenport/claude-mods
```

See the [repository README](../../README.md#install) for installing every mod, or from a local checkout.

## When it fills

A question is `❓` followed by `Q<n>`, bold or not, in any case, as the
`mattpocock-skills:grilling` skill writes them. A round prefix, `R<n>-Q<n>`,
counts too:

```
❓ **Q1** - **Storage**: Where do drafts live?
❓ q2. Per session or global?
❓ R2-Q1 Which port?
```

The template takes each question once, labelled as asked but lowercase, in
the order first asked: a second round asking Q4 and Q5 gives `q4. ` and
`q5. `, and one asking R2-Q1 and R2-Q2 gives `r2-q1. ` and `r2-q2. `. A `Q1`
without the `❓` (a reference back to an earlier question) doesn't count.

The box is left alone when:

- it already holds text: a draft you started is never overwritten;
- the turn was interrupted, or was a subagent's;
- a dialog is open, or there's no prompt box (`claude -p`, the SDK).

The first thing you type lands after the first label (`q1. `). If you move
the cursor before typing, your typing goes where you put it.

## Requirements

- **Workspace trust.** Hooks modules don't load until a workspace's trust
  dialog is accepted.

## Develop

Run `pnpm test` and `pnpm lint` from the repository root; see its [README](../../README.md#develop).

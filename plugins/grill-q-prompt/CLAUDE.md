# grill-q-prompt

A `turn.complete` hook that fills the empty prompt box with a `qN. ` answer template when a reply asks numbered `❓ Q<n>` questions. The root `CLAUDE.md` holds the rules every plugin here shares.

## Testing

- `tests/fixtures/prompt-box.ts` already answers `prompt.read`, `prompt.fill`, `prompt.edit` and `turn.complete`. Raise an edit with its `editIn`: the test engine runs `$.prompt.edit`, but its type omits it.
- **A test hook standing in for a `$` call answers `{ value }`** (`prompt.read` returns `{ value: { text, cursor } }`). A bare result skips the plugin's hook.
- Behaviour changes go tests first, through `$.turn.complete` against `promptBoxOf`.

## Verifying against the real binary

`prompt.fill` refuses under `-p` (`no_composer`), so the probe is interactive, driven through tmux:

1. `tmux new-session -d -s probe -x 160 -y 50 -c /tmp/<probe-dir> "claude --model haiku --debug-file /tmp/probe.log"` (the installed plugin reads this folder; add `--plugin-dir <repo>/plugins/grill-q-prompt` only with the installed one disabled).
2. Type a prompt that makes the reply ask `❓ **Q1**`… questions with `tmux send-keys -t probe -l '<text>'`.
3. Submit with Shift+Enter, sent as `tmux send-keys -t probe -H 1b 5b 31 33 3b 32 75`: Josh's keybindings make Enter a newline.
4. Evidence is `tmux capture-pane -p -t probe` showing the template in the box, plus `hooks module grill-q-prompt… turn.complete settled` in the debug log. Kill the session after.

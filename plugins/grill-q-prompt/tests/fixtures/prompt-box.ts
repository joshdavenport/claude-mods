import type { On, PromptEditInput, PromptFillInput } from 'claude-code'
import type { Engine, EngineCall } from 'claude-code/testing'

/**
 * The person's edit in the prompt box, through every plugin's `prompt.edit`
 * hook and the test's beneath. The test engine raises `prompt.edit`, but its
 * `Engine` type lists only the `prompt` calls a plugin may make, so the noun
 * is widened by that one event here.
 *
 * @param $ the test's engine
 * @param e the edit
 * @returns the box after it
 */
export const editIn = ($: Engine, e: PromptEditInput) =>
  ($ as Engine & { prompt: { edit: EngineCall<'prompt.edit'> } }).prompt.edit(e)

/**
 * Stands in for the engine's prompt box: `draft` is what the person has
 * typed so far, and every write that reaches the box is kept, in order, for
 * the test to read. Also answers `turn.complete` and `prompt.edit` as core
 * does, so a test raises a turn's end with `$.turn.complete` and a keystroke
 * with `editIn`.
 *
 * @param on the test's `on`
 * @param draft the box's text before the turn ends
 * @returns the writes that reached the box
 */
export function promptBoxOf(on: On, draft = ''): { fills: PromptFillInput[] } {
  const fills: PromptFillInput[] = []

  on('prompt.read', () => ({
    value: { text: draft, cursor: draft.length },
  }))
  on('prompt.fill', ($, e) => {
    fills.push(e)

    return { isFilled: true }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('prompt.edit', ($, e) => ({
    text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end),
    cursor: e.start + e.inputText.length,
  }))

  return { fills }
}

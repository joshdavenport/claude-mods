import type { On } from 'claude-code'

/**
 * A question as the grilling skill opens one (`❓ **Q1** - **title**: …`),
 * bold or not, any case, optionally in a numbered round (`❓ R2-Q1`); the
 * label is the match.
 */
const QUESTION = /(?<=❓\s*\**)(?:R\d+-)?Q\d+\b/gi

/**
 * The answer template for a reply: a line per question it asks, labelled as
 * asked but lowercase (`q1. `, `r2-q1. `), in the order first asked, or
 * undefined when it asks none.
 */
function templateOf(answer: string): string | undefined {
  const labels = new Set([...answer.matchAll(QUESTION)].map(([label]) => label.toLowerCase()))

  return labels.size === 0 ? undefined : [...labels].map(label => `${label}. `).join('\n')
}

/**
 * The template last put in the box, until the person's first edit after it:
 * the box leaves the cursor at its end, and that edit is the one that may
 * be moved to the first line. Every other edit stops at this check.
 */
let filled: string | undefined

/**
 * Registers the `turn.complete` hook: when a reply asks numbered ❓
 * questions, the prompt box gets a `qN. ` (or `rN-qN. `) line for each,
 * ready to answer in.
 *
 * Also registers a `prompt.edit` hook: typing straight into a template just
 * filled lands at the end of the first line rather than of the box, where
 * the fill left the cursor. Moving the cursor first, or any edit to the box but the first,
 * goes through as made.
 *
 * @param on the engine's registrar
 */
export function register(on: On): void {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    // A subagent's reply never reaches the person, and an interrupted one
    // may have been cut off mid-round.
    if (e.agentId !== undefined || e.reason !== 'answer') {
      return result
    }

    const template = templateOf(e.answer)

    if (template !== undefined && (await $.prompt.read()).text.trim() === '') {
      const { isFilled } = await $.prompt.fill({
        text: template,
        mode: 'replace',
      })

      filled = isFilled ? template : undefined
    }

    return result
  })

  on('prompt.edit', ($, e, next) => {
    if (filled === undefined) {
      return next(e)
    }

    const template = filled

    filled = undefined

    if (
      e.text !== template ||
      e.inputText === '' ||
      e.start !== template.length ||
      e.end !== template.length
    ) {
      return next(e)
    }

    const at = template.indexOf('\n')
    const firstLineEnd = at === -1 ? template.length : at

    return {
      text: template.slice(0, firstLineEnd) + e.inputText + template.slice(firstLineEnd),
      cursor: firstLineEnd + e.inputText.length,
    }
  })
}

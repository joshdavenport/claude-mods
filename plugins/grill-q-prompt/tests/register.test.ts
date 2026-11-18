import { describe, expect, test } from 'claude-code/testing'

import { editIn, promptBoxOf } from './fixtures/prompt-box'

/**
 * A main-loop turn that ended in `answer`, every other field filler.
 */
const turnOf = (answer: string) => ({
  answer,
  durationMs: 0,
  isAborted: false,
  turnId: 'turn-1',
  reason: 'answer' as const,
})

/**
 * The person typing `inputText` at `at` in `text` (the end, unless given),
 * the caret there.
 */
const typingOf = (text: string, inputText: string, at = text.length) => ({
  origin: { kind: 'composer' as const },
  text,
  cursor: at,
  start: at,
  end: at,
  inputText,
})

/**
 * A round as the grilling skill formats it.
 */
const ROUND = [
  "Here's the first round.",
  '',
  '❓ **Q1** - **Storage**: Where do drafts live?',
  '',
  '➡️ In memory.',
  '',
  '❓ **Q2** - **Scope**: Per session or global? See Q1.',
  '',
  '➡️ Per session.',
  '',
  '❓ **Q3** - **Naming**: What do we call it?',
  '',
  '➡️ grill-q-prompt.',
].join('\n')

describe('register', () => {
  test('a round fills the empty box with a line per question', async ($, on) => {
    const { fills } = promptBoxOf(on)

    await $.turn.complete(turnOf(ROUND))

    expect(fills.map(({ text, mode }) => ({ text, mode }))).toEqual([
      { text: 'q1. \nq2. \nq3. ', mode: 'replace' },
    ])
  })

  test("a later round keeps its questions' numbers, each once", async ($, on) => {
    const { fills } = promptBoxOf(on)

    await $.turn.complete(
      turnOf(
        ['❓ Q4. Which port?', '❓ Q5. Which host?', 'Q4 decides Q5, so take ❓ Q4. first.'].join(
          '\n\n',
        ),
      ),
    )

    expect(fills.map(({ text }) => text)).toEqual(['q4. \nq5. '])
  })

  test('a lowercase q counts', async ($, on) => {
    const { fills } = promptBoxOf(on)

    await $.turn.complete(turnOf('❓ q1. Which port?\n\n❓ **q2** Which host?'))

    expect(fills.map(({ text }) => text)).toEqual(['q1. \nq2. '])
  })

  test("a round prefix carries into the template, each round's questions apart", async ($, on) => {
    const { fills } = promptBoxOf(on)

    await $.turn.complete(
      turnOf(
        [
          '❓ **R2-Q1** - **Port**: Which port?',
          '❓ r2-q2. Which host?',
          '❓ R3-Q1 Which user?',
        ].join('\n\n'),
      ),
    )

    expect(fills.map(({ text }) => text)).toEqual(['r2-q1. \nr2-q2. \nr3-q1. '])
  })

  test('a reply without questions leaves the box alone', async ($, on) => {
    const { fills } = promptBoxOf(on)

    await $.turn.complete(turnOf('Done. Q1 and Q2 are both settled.'))

    expect(fills).toEqual([])
  })

  test('a draft in the box is kept', async ($, on) => {
    const { fills } = promptBoxOf(on, 'actually, one thing first')

    await $.turn.complete(turnOf(ROUND))

    expect(fills).toEqual([])
  })

  test("a subagent's round leaves the box alone", async ($, on) => {
    const { fills } = promptBoxOf(on)

    await $.turn.complete({ ...turnOf(ROUND), agentId: 'agent-1' })

    expect(fills).toEqual([])
  })

  test('an interrupted round leaves the box alone', async ($, on) => {
    const { fills } = promptBoxOf(on)

    await $.turn.complete({
      ...turnOf(ROUND),
      isAborted: true,
      reason: 'aborted',
    })

    expect(fills).toEqual([])
  })

  describe('typing into the template', () => {
    test('the first key lands after q1.', async ($, on) => {
      promptBoxOf(on)

      await $.turn.complete(turnOf(ROUND))

      expect(await editIn($, typingOf('q1. \nq2. \nq3. ', 'r'))).toEqual({
        text: 'q1. r\nq2. \nq3. ',
        cursor: 5,
      })
    })

    test('after a cursor move, typing lands where the person put it', async ($, on) => {
      promptBoxOf(on)

      await $.turn.complete(turnOf(ROUND))
      await editIn($, typingOf('q1. \nq2. \nq3. ', '', 0))

      expect(await editIn($, typingOf('q1. \nq2. \nq3. ', 'r'))).toEqual({
        text: 'q1. \nq2. \nq3. r',
        cursor: 15,
      })
    })

    test('a template the person typed themselves is theirs', async ($, on) => {
      promptBoxOf(on)

      expect(await editIn($, typingOf('q7. \nq8. ', 'r'))).toEqual({
        text: 'q7. \nq8. r',
        cursor: 10,
      })
    })
  })
})

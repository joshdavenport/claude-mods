import { atom, read, update } from 'claude-code'
import type { ApiContentBlock, EngineInterface, Register } from 'claude-code'

import type { Expansion } from '../types'

const PLUGIN = 'skill-prompt-view'

// Bump the tag when Expansion's fields change: it declines what an earlier
// version stored, which outlives a reload.
const expansions = atom({ plugin: 'skill-prompt-view', key: 'expansions' } as const, [], {
  shape: 'expansions-1',
})

// Placed rows don't survive --resume, so older entries are dead weight.
const KEEP = 50

// One drawing holds 100,000 characters; leave room for the notice.
const MAX_CHARS = 99_000

// Markdown takes tab and newline as its only control characters.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g

export const printable = (text: string): string => {
  const clean = text.replace(CONTROL, '')

  return clean.length <= MAX_CHARS
    ? clean
    : `${clean.slice(0, MAX_CHARS)}\n\n… ${clean.length - MAX_CHARS} more characters not shown`
}

// How much of a prompt's start identifies the row that carries it.
const HEAD_CHARS = 200

const textOf = (blocks: readonly ApiContentBlock[]): string =>
  blocks.map(block => (block.type === 'text' ? (block.text ?? '') : '')).join('\n')

// Expansions waiting for the row that carries them to be stored. A skill
// expands before its command line reaches the transcript, so placing at
// expansion would put the row above that line. Lost on a reload, which only
// costs the rows of a skill expanding at that moment.
let waiting: { id: string; head: string }[] = []

async function placeWaiting($: EngineInterface, ids: readonly string[]) {
  waiting = waiting.filter(one => !ids.includes(one.id))
  for (const id of ids) {
    await $.ui.place({ id })
  }
}

export const register: Register = on => {
  // Record the text the model reads (what the hooks beneath answered).
  on('skill.prompt', async ($, e, next) => {
    const result = await next(e)
    const id = crypto.randomUUID()
    const expansion: Expansion = {
      id,
      skill: e.skill,
      text: result.text,
      isHidden: true,
    }

    await update($, expansions, list => [...list, expansion].slice(-KEEP))
    waiting = [...waiting, { id, head: result.text.slice(0, HEAD_CHARS) }]

    return result
  })

  // Place an expansion's row once the row carrying its prompt is stored.
  on('session.append', async ($, e, next) => {
    const stored = await next(e)

    if (waiting.length === 0 || stored.deny !== undefined) {
      return stored
    }

    const text = textOf(stored.message.content)
    const carried = waiting.filter(one => text.includes(one.head))
    await placeWaiting(
      $,
      carried.map(one => one.id),
    )

    return stored
  })
    // A failure here must never touch the row: relay what next settled to.
    .catch(($, e, next) => next(e))

  // An expansion no row carried still shows, at the turn's end.
  on('turn.complete', async ($, e, next) => {
    await placeWaiting(
      $,
      waiting.map(one => one.id),
    )

    return next(e)
  })

  on('ui.render', { component: 'Placed', props: { plugin: PLUGIN } }, async ($, e, next) => {
    const expansion = (await read($, expansions)).find(one => one.id === e.props.id)

    if (!expansion) {
      return next(e)
    }

    const { Box, Button, Markdown, Text } = $.ui.resolve(e)
    const lines = expansion.text.split('\n').length
    const toggle = () =>
      update($, expansions, list =>
        list.map(one => (one.id === expansion.id ? { ...one, isHidden: !one.isHidden } : one)),
      )

    return (
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Box>
          <Text dimColor>
            Skill prompt: /{expansion.skill} · {lines} lines{' '}
          </Text>
          <Button
            key={`toggle-${expansion.id}`}
            label={expansion.isHidden ? 'Show' : 'Hide'}
            onPress={toggle}
          />
        </Box>
        {!expansion.isHidden && <Markdown text={printable(expansion.text)} />}
      </Box>
    )
  })
}

import { expect, test } from 'claude-code/testing'

const PROMPT = '# Build plenum#101\n\n<hand-off from="plenum#100">\n- notes\n</hand-off>'

test('an expanded skill prompt starts folded, and Show unfolds it', async ($, on) => {
  // Hooks here stand for the engine beneath the mod.
  let placedId = ''
  on('ui.place', (_, e) => {
    placedId = e.id
    return { value: { isPlaced: true, requestId: 'row-1' } }
  })
  on('skill.prompt', (_, e) => ({ text: e.text }))

  const result = await $.skill.prompt({ skill: 'sheprd:sheprd', text: PROMPT })
  // The model reads what it would have read without the mod.
  expect(result.text).toBe(PROMPT)

  // The row waits for the prompt's own row, so it lands below the command line.
  expect(placedId).toBe('')
  await $.session.append({
    message: {
      type: 'user',
      role: 'user',
      isMeta: true,
      content: [{ type: 'text', text: PROMPT }],
    },
    door: 'command',
    origin: { kind: 'composer' },
    uuid: 'prompt-row',
  })
  expect(placedId).not.toBe('')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'skill-prompt-view',
      surface,
      component: 'Placed',
      props: { id: placedId, plugin: 'skill-prompt-view' },
    })

    expect(await ui.find({ type: 'Markdown' })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /sheprd:sheprd/ }))?.text).toBe(
      'Skill prompt: /sheprd:sheprd · 5 lines ',
    )
    expect((await ui.find({ type: 'Button' }))?.props.label).toBe('Show')

    await ui.press({ key: `toggle-${placedId}` })
    expect((await ui.find({ type: 'Markdown' }))?.text).toBe(PROMPT)

    await ui.press({ key: `toggle-${placedId}` })
    expect(await ui.find({ type: 'Markdown' })).toBeUndefined()
    await ui.unmount()
  }
})

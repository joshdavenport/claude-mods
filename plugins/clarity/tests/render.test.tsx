import { expect, test } from 'claude-code/testing'

import { cells } from '../hooks/markdown'
import { headingIcon, readPill } from '../hooks/vocabulary'

const reply = (text: string) =>
  ({
    plugin: 'clarity',
    component: 'AssistantMessage',
    props: { text, isFirstOfReply: true },
  }) as const

test('headings are underlined to their width, by level', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      ...reply('# Title\n\n## Sub section\n\n### Deep\n\n#### Fourth\n\n##### Fifth'),
      surface,
    })
    expect(await ui.find({ type: 'Text', text: /^=====$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^-{11}$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^·{4}$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^· · ·$/ })).toBeDefined()
    // Below h4 the heading has no line under it.
    expect(await ui.findAll({ type: 'Text', text: /^[=\-· ]+$/ })).toHaveLength(4)
    await ui.unmount()
  }
})

test('a pill draws as a chip with its icon, outside code', async $ => {
  const ui = await $.ui.mount({
    ...reply('Deploy [[Completed]] and `[[Done]]`'),
    surface: 'terminal',
  })
  expect(await ui.find({ type: 'Text', text: ' Done' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '[[Done]]' })).toBeDefined()
  await ui.unmount()
})

test('a table goes to the built-in renderer with pills as plain words', async $ => {
  const ui = await $.ui.mount({
    ...reply('| a | b |\n|---|---|\n| [[Failed: 3]] | x |'),
    surface: 'terminal',
  })
  expect(await ui.find({ type: 'Markdown', text: /\| Failed: 3 \|/ })).toBeDefined()
  await ui.unmount()
})

test('pill words: synonyms, detail and tone', () => {
  expect(readPill('Completed')).toMatchObject({ text: 'Done', tone: 'success' })
  expect(readPill('failing: 3 tests')).toMatchObject({
    text: 'Failed: 3 tests',
    tone: 'error',
  })
  expect(readPill('Needs you')).toMatchObject({ tone: 'warning' })
  expect(readPill('Something else')).toMatchObject({
    icon: undefined,
    tone: 'neutral',
  })
})

test('a heading takes the icon of its first word', () => {
  expect(headingIcon('How')).toBeDefined()
  expect(headingIcon('How it works')).toBe(headingIcon('How'))
  expect(headingIcon('Caveats:')).toBe(headingIcon('Caveat'))
  expect(headingIcon('Findings so far')).toBe(headingIcon('Finding'))
  expect(headingIcon('Questions for you')).toBeDefined()
  expect(headingIcon('What I need from you')).toBe(headingIcon('What'))
  // Only a whole first word matches, and a glyph the model typed itself wins.
  expect(headingIcon('Howdy')).toBeUndefined()
  expect(headingIcon(' How it works')).toBeUndefined()
})

test('cell width counts wide characters twice', () => {
  expect(cells('abc')).toBe(3)
  expect(cells('日本')).toBe(4)
  expect(cells(' ok')).toBe(4)
})

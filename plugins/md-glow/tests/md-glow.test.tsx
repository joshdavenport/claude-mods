import { describe, expect, test } from 'claude-code/testing'

import { parseAnsi } from '../hooks/ansi'

const ESC = '\x1b'

describe('parseAnsi', () => {
  test('styles runs, merges like runs and drops glow’s right padding', async () => {
    // As glow writes a heading: one SGR per character, then padding to the width.
    const raw = `  ${ESC}[93;104;1m ${ESC}[0m${ESC}[93;104;1mBrief${ESC}[0m${ESC}[37m ${ESC}[0m${ESC}[37m ${ESC}[0m\n`
    expect(parseAnsi(raw)).toEqual([
      [
        { text: '  ' },
        {
          text: ' Brief',
          color: 'yellowBright',
          backgroundColor: 'blueBright',
          bold: true,
        },
      ],
    ])
  })

  test('reads 256-colour and truecolour, and strips non-SGR escapes', async () => {
    const raw = `${ESC}]8;;https://x.dev${ESC}\\${ESC}[38;5;196ma${ESC}[38;2;1;2;3mb${ESC}[2Kc`
    expect(parseAnsi(raw)).toEqual([
      [
        { text: 'a', color: '#ff0000' },
        { text: 'bc', color: '#010203' },
      ],
    ])
  })

  test('keeps blank lines inside the document but not around it', async () => {
    expect(parseAnsi('\n\n  a\n\n  b\n\n').map(line => line.map(s => s.text).join(''))).toEqual([
      '  a',
      '',
      '  b',
    ])
  })
})

const BAND = {
  plugin: 'md-glow',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const PANE = {
  plugin: 'md-glow',
  component: 'Pane',
  requestId: 'md-glow',
  surface: 'terminal',
  props: {
    title: 'brief.md',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('a written brief is offered until dismissed, and View shows glow’s rendering in the pane', async ($, on) => {
  const glowRuns: (readonly string[])[] = []
  on('tool.call', () => ({ result: {} }))
  // Stands for the engine's own drawing beneath the mod.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('clock.now', () => ({ value: 1 }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('fs.stat', () => ({
    value: { kind: 'file', size: 10, mtimeMs: 1, isLink: false },
  }))
  on('process.run', (_, e) => {
    glowRuns.push(e.argv)
    return {
      value: {
        exitCode: 0,
        stdout: `  ${ESC}[1mDraft brief${ESC}[0m   \n\n  Body text`,
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })

  await $.tool.call({
    tool: 'Write',
    file_path: '/work/docs/brief.md',
    content: '# Draft brief',
  })

  const band = await $.ui.mount(BAND)
  expect((await band.find({ type: 'Text', text: /brief\.md/ }))?.text).toContain('brief.md')
  await band.press({ key: 'view' })
  await band.unmount()

  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ type: 'Text', text: /Draft brief/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Body text/ })).toBeDefined()
  expect(glowRuns[0]).toEqual(['glow', '--style', 'dark', '--width', '60', '/work/docs/brief.md'])
  await pane.unmount()

  // The offer outlives viewing; only Dismiss clears it.
  const after = await $.ui.mount(BAND)
  expect(await after.find({ type: 'Text', text: /brief\.md/ })).toBeDefined()
  await after.press({ key: 'dismiss' })
  expect(await after.find({ type: 'Text', text: /brief\.md/ })).toBeUndefined()
  await after.unmount()
})

test('markdown the engine writes for itself is not offered', async ($, on) => {
  on('tool.call', () => ({ result: {} }))
  // Stands for the engine's own drawing beneath the mod.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('clock.now', () => ({ value: 1 }))

  await $.tool.call({
    tool: 'Write',
    file_path: '/Users/me/.claude/projects/x/memory/note.md',
    content: 'x',
  })

  const band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: /note\.md/ })).toBeUndefined()
  await band.unmount()
})

test('a glow run that fails is retried on the next draw, not cached', async ($, on) => {
  // A newer redraw aborts an older one's run: the first draw's runs reject.
  let isAborting = true
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('clock.now', () => ({ value: 1 }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', () => ({ value: { command: 'glow' } }))
  on('fs.stat', () => ({
    value: { kind: 'file', size: 10, mtimeMs: 1, isLink: false },
  }))
  on('process.run', () => {
    if (isAborting) throw new Error('aborted')
    return {
      value: {
        exitCode: 0,
        stdout: '  Rendered',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })

  await $.tool.call({ tool: 'Write', file_path: '/work/a.md', content: 'x' })
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'view' })
  await band.unmount()

  const first = await $.ui.mount(PANE)
  expect(await first.find({ type: 'Text', text: /could not run/ })).toBeDefined()
  await first.unmount()

  isAborting = false
  const second = await $.ui.mount(PANE)
  expect(await second.find({ type: 'Text', text: /Rendered/ })).toBeDefined()
  await second.unmount()
})

test('each file row switches the pane, and the rows stay where they were', async ($, on) => {
  const paths = [
    '/w/draft-brief.md',
    '/w/briefs/onboarding-flow.md',
    '/w/notes/meeting-2026-11-03.md',
  ]
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('clock.now', () => ({ value: 1 }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('fs.stat', () => ({
    value: { kind: 'file', size: 10, mtimeMs: 1, isLink: false },
  }))
  on('process.run', (_, e) => ({
    value: {
      exitCode: 0,
      stdout: `  BODY ${e.argv.at(-1)}`,
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))

  for (const file_path of paths) await $.tool.call({ tool: 'Write', file_path, content: 'x' })
  const band = await $.ui.mount(BAND)
  await band.press({ key: 'view' })
  await band.unmount()

  const pane = await $.ui.mount(PANE)
  const rows = async () => (await pane.findAll({ type: 'Button' })).map(b => b.key)
  const before = await rows()
  // Newest first, the viewed file included.
  expect(before).toEqual([...paths].reverse().map(p => `file:${p}`))

  for (const p of paths) {
    await pane.press({ key: `file:${p}` })
    expect((await pane.find({ type: 'Text', text: /BODY/ }))?.text).toBe(`  BODY ${p}`)
    expect(await rows()).toEqual(before)
  }
  await pane.unmount()
})

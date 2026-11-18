// Regenerates docs/showcase/<mod>.png: for each mod, starts Claude Code in a
// throwaway Rex session with only that mod enabled, drives the feature, captures
// the terminal as HTML and screenshots it.
//
//   pnpm showcase              every mod
//   pnpm showcase md-glow      just one
//
// Needs Rex running, the mods installed (see README), Chrome, and the
// JetBrainsMono Nerd Font. Each run makes real model calls (Haiku).

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { render } from './render.ts'
import { scenarios, type Scenario } from './scenarios.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const OUT = join(ROOT, 'docs/showcase')
const MARKETPLACE = 'joshdavenport-mods'
const MODS = ['clarity', 'grill-q-prompt', 'md-glow', 'skill-augment', 'skill-prompt-view']

const rex = (...args: string[]) => execFileSync('rex', args, { encoding: 'utf8' })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** The key that submits a prompt: the person's `chat:submit` binding, else Enter. */
const submitKey = (): string => {
  const path = join(homedir(), '.claude/keybindings.json')
  if (!existsSync(path)) return 'enter'
  type Bindings = { bindings?: { context?: string; bindings?: Record<string, string> }[] }
  const chat = (JSON.parse(readFileSync(path, 'utf8')) as Bindings).bindings?.find(
    b => b.context === 'Chat',
  )?.bindings
  if (chat === undefined || chat.enter === 'chat:submit' || chat.enter === undefined) return 'enter'
  return Object.entries(chat).find(([, action]) => action === 'chat:submit')?.[0] ?? 'enter'
}

/**
 * Settings layered over the person's own: only `mod` enabled, no status line, no
 * vim mode, no prompt suggestions, and this repository's CLAUDE.md files (above the demo folder) unread.
 */
const settingsFor = (mod: string) =>
  JSON.stringify({
    enabledPlugins: Object.fromEntries(MODS.map(m => [`${m}@${MARKETPLACE}`, m === mod])),
    statusLine: { type: 'command', command: 'true' },
    editorMode: 'normal',
    promptSuggestionEnabled: false,
    claudeMdExcludes: [join(ROOT, 'CLAUDE.md'), join(ROOT, 'plugins/*/CLAUDE.md')],
  })

class Terminal {
  readonly session: string
  readonly block: string

  constructor(session: string, block: string) {
    this.session = session
    this.block = block
  }

  text = () => rex('capture', '-s', this.session, '-b', this.block, '--trim')
  html = () => rex('capture', '-s', this.session, '-b', this.block, '--format=html')
  type = (text: string) => rex('send', '-s', this.session, '-b', this.block, text)
  key = (key: string) => rex('send-key', '-s', this.session, '-b', this.block, key)

  /**
   * Clicks the middle of the first place the screen shows `label`, as an SGR mouse
   * press and release (Claude Code turns SGR mouse reporting on). Counts one cell
   * per character before the label on its row.
   */
  click(label: string) {
    const rows = rex('capture', '-s', this.session, '-b', this.block).split('\n')
    const row = rows.findIndex(r => r.includes(label))
    if (row === -1) throw new Error(`nothing on screen reads "${label}"`)
    // Code points, not UTF-16 units: a glyph outside the BMP still takes one cell.
    const column = Array.from((rows[row] ?? '').slice(0, rows[row]?.indexOf(label))).length
    const x = column + Math.ceil(label.length / 2)
    const y = row + 1
    this.type(`\x1b[<0;${x};${y}M\x1b[<0;${x};${y}m`)
  }

  /** Waits until the screen matches `pattern`. */
  async until(pattern: RegExp, timeoutMs = 30_000) {
    const start = Date.now()
    let screen = this.text()
    while (!pattern.test(screen)) {
      if (Date.now() - start > timeoutMs) {
        const tail = screen.trimEnd().split('\n').slice(-25).join('\n')
        throw new Error(`timed out waiting for ${pattern}; the screen ends:\n${tail}`)
      }
      await sleep(500)
      screen = this.text()
    }
  }

  /** Waits until no spinner shows and the screen has held still for two seconds. */
  async idle(timeoutMs = 120_000) {
    const start = Date.now()
    let last = ''
    let stillSince = Date.now()
    while (Date.now() - start < timeoutMs) {
      await sleep(500)
      const now = this.text()
      if (now !== last) {
        last = now
        stillSince = Date.now()
      } else if (!/…\s*\(\d/.test(now) && Date.now() - stillSince > 2000) return
    }
    throw new Error('timed out waiting for the session to go idle')
  }
}

const run = async (scenario: Scenario, submit: string) => {
  // Inside this repository, so the folder is already trusted; .showcase is ignored by git.
  const dir = join(ROOT, '.showcase', scenario.mod)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (const [path, content] of Object.entries(scenario.files ?? {})) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), content)
  }

  // The terminal is created at the scenario's size and runs Claude Code directly. Rex
  // keeps that size while no app owns the terminal, so leave the showcase tab unopened.
  const session = (
    JSON.parse(rex('new', `showcase-${scenario.mod}`, '-c', dir, '--json')) as {
      session_id: string
    }
  ).session_id
  const command = [
    'claude',
    '--model',
    'haiku',
    '--permission-mode',
    scenario.permissionMode ?? 'default',
    '--settings',
    settingsFor(scenario.mod),
  ]
  const layout = {
    block: {
      flavor: 'com.superlogical.terminal.shell',
      options: { cwd: dir, command, size: { columns: scenario.columns, rows: scenario.rows } },
    },
  }
  const window = JSON.parse(
    rex(
      'api',
      'call',
      '-s',
      session,
      'session.new_window',
      JSON.stringify({ window_label: scenario.mod, focus: false, layout }),
    ),
  ) as { block_ids: string[] }
  const block = window.block_ids[0]
  if (block === undefined) throw new Error('session.new_window returned no block')
  const term = new Terminal(session, block)

  try {
    await term.until(/Yes, I trust this folder|^─+[ ]*\n❯/m)
    if (/Yes, I trust this folder/.test(term.text())) {
      throw new Error(`Claude Code asks to trust ${dir}: run claude there once and choose Yes`)
    }

    for (const step of scenario.steps) {
      if ('prompt' in step) {
        term.type(step.prompt)
        await sleep(300)
        term.key(submit)
      } else {
        term.click(step.click)
      }
      await term.idle()
    }

    mkdirSync(OUT, { recursive: true })
    const png = join(OUT, `${scenario.mod}.png`)
    const from = scenario.cropFrom ?? 'prompt'
    render(term.html(), { ...scenario, from }, join(dir, 'showcase.html'), png)
    console.log(`${scenario.mod}: ${png}`)
  } finally {
    rex('kill', session)
  }
}

const asked = process.argv.slice(2)
const chosen = asked.length === 0 ? scenarios : scenarios.filter(s => asked.includes(s.mod))
const submit = submitKey()
for (const scenario of chosen) await run(scenario, submit)

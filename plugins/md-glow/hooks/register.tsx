import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { parseAnsi, type Line } from './ansi'

const PANE = 'md-glow'
const COMMAND = 'glow'
// glow's own line width tops out here however wide the pane is: past it prose reads badly.
const MAX_WIDTH = 100
// Where `glow` may live when the session's PATH lacks Homebrew's (a GUI launch).
const GLOW = ['glow', '/opt/homebrew/bin/glow', '/usr/local/bin/glow']
// Markdown the engine writes for itself (memory, tool output), not worth offering.
const IGNORED = /\/\.claude\/projects\//

// Change the tag when MdFile's fields change: it declines what an earlier version stored.
const files = atom({ plugin: 'md-glow', key: 'files' } as const, [], {
  shape: 'files-1',
})
const offer = atom({ plugin: 'md-glow', key: 'offer' } as const, null)
const viewing = atom({ plugin: 'md-glow', key: 'viewing' } as const, null)

const isMarkdown = (path: string) => /\.(md|markdown|mdx)$/i.test(path) && !IGNORED.test(path)
const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)
const dirname = (path: string) => path.slice(0, path.lastIndexOf('/') + 1)
// The file and its folder: enough to tell `briefs/x.md` from `notes/x.md`.
const shortPath = (path: string) => path.split('/').slice(-2).join('/')

type Rendered = { lines: Line[] } | { error: string }

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Runs glow on `path` at `width`, trying each known location of the binary. */
const runGlow = async ($: EngineInterface, path: string, width: number): Promise<Rendered> => {
  const failures: string[] = []
  for (const bin of GLOW) {
    try {
      const { exitCode, stdout, stderr } = await $.process.run(
        [bin, '--style', 'dark', '--width', String(width), path],
        // glow drops its colours when stdout isn't a terminal unless forced.
        { env: { CLICOLOR_FORCE: '1' }, timeoutMs: 10_000 },
      )
      if (exitCode !== 0) return { error: stderr.trim() || `glow exited with ${exitCode}` }
      return { lines: parseAnsi(stdout) }
    } catch (error) {
      // Missing at this location, or the run was cut short: try the next.
      failures.push(`${bin}: ${message(error)}`)
    }
  }
  return { error: `glow could not run.\n${failures.join('\n')}` }
}

// Module-level, so a reload starts it empty. Keyed by path, width and mtime, so
// an edit or a resize renders afresh and a scroll (which redraws) doesn't run
// glow again. Only successes are kept: a newer redraw aborts an older one's
// `$.process.run`, and that failure must not stick to the file.
const cache = new Map<string, Rendered>()

const render = async ($: EngineInterface, path: string, width: number): Promise<Rendered> => {
  let mtime: number
  try {
    mtime = (await $.fs.stat(path)).mtimeMs
  } catch (error) {
    return { error: `Could not read ${path}: ${message(error)}` }
  }
  const key = `${path}\0${width}\0${mtime}`
  const hit = cache.get(key)
  if (hit) return hit
  const rendered = await runGlow($, path, width)
  if ('lines' in rendered) {
    if (cache.size > 32) cache.clear()
    cache.set(key, rendered)
  }
  return rendered
}

const view = async ($: EngineInterface, path: string) => {
  await update($, viewing, () => path)
  return $.ui.open({ id: PANE, title: basename(path) })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'View a markdown file rendered by glow (default: the latest written)',
    })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.tool !== 'Write' && e.tool !== 'Edit') return ran
    if (!isMarkdown(e.file_path) || ran.deny !== undefined || ran.isError) return ran

    const path = e.file_path
    const at = await $.clock.now()
    // Every write lands here, so the pane redraws when the file it shows changes.
    await update($, files, list =>
      [...list.filter(f => f.path !== path), { path, writtenAt: at }].slice(-50),
    )
    // A Write (a new file, or a rewrite) is offered; the band stays until dismissed.
    if (e.tool === 'Write') await update($, offer, () => path)
    return ran
  }).catch(($, e, next) => next(e))

  on('command.run', { command: COMMAND }, async ($, e) => {
    const asked = e.args.trim()
    if (asked !== '') {
      const stat = await $.fs.stat(asked, { resolve: true }).catch(() => undefined)
      if (stat?.kind !== 'file') return { text: `${asked} is not a file.` }
      await view($, stat.realPath ?? asked)
      return { text: `Showing ${asked} in the glow pane.` }
    }
    const latest = (await read($, files)).at(-1)
    if (!latest)
      return {
        text: 'No markdown file has been written this session yet. Try /glow <path>.',
      }
    await view($, latest.path)
    return { text: `Showing ${basename(latest.path)} in the glow pane.` }
  }).catch(($, e, next) => ({
    text: `md-glow could not open the pane: ${String(next.error)}`,
  }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const path = await read($, offer)
    if (path === null || e.props.hasSurvey) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box gap={1}>
        <Text>
          <Text color="claude">◆</Text> {basename(path)} <Text dimColor>written</Text>
        </Text>
        <Button key="view" label="View with glow" variant="primary" onPress={() => view($, path)} />
        <Button
          key="dismiss"
          label="Dismiss"
          dimColor
          onPress={() => update($, offer, () => null)}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const path = await read($, viewing)
    const list = await read($, files)

    if (path === null) return <Text dimColor>No markdown file chosen. Run /glow &lt;path&gt;.</Text>

    const width = Math.max(20, Math.min(e.props.bodyColumns, MAX_WIDTH))
    const rendered = await render($, path, width)
    // Newest first, the viewed file kept in its place: a press never moves the
    // rows under the pointer, so the next click lands where it was aimed.
    const written = [...list].reverse()

    return (
      <Box flexDirection="column">
        <Text wrap="truncate-start">
          <Text dimColor>{dirname(path)}</Text>
          <Text bold>{basename(path)}</Text>
        </Text>
        {written.length > 1 && (
          <Box flexDirection="column">
            {written.map((f, i) => {
              const isViewed = f.path === path
              return (
                <Button
                  key={`file:${f.path}`}
                  hotkey={i < 9 ? String(i + 1) : undefined}
                  plain
                  dimColor={!isViewed}
                  onPress={() => view($, f.path)}
                >
                  {`${isViewed ? '▸' : ' '} ${shortPath(f.path)}`}
                </Button>
              )
            })}
          </Box>
        )}
        <Text> </Text>
        {'error' in rendered ? (
          <Text color="error">{rendered.error}</Text>
        ) : (
          rendered.lines.map(line =>
            line.length === 0 ? (
              <Text> </Text>
            ) : (
              <Text>
                {line.map(({ text, ...style }) => (
                  <Text {...style}>{text}</Text>
                ))}
              </Text>
            ),
          )
        )}
      </Box>
    )
  })
}

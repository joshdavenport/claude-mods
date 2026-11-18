// Turns a Rex HTML capture of a Claude Code session into a framed page, and the
// page into a PNG with headless Chrome.

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FONT = "'JetBrainsMono Nerd Font Mono', 'JetBrainsMono NFM', monospace"
const FONT_PX = 14
const LINE_PX = 18
// JetBrains Mono's advance is 0.6em.
const CELL_PX = FONT_PX * 0.6
const BACKGROUND = '#1c1c1f'
const PADDING_PX = 24
const MARGIN_PX = 32

/** Whether a capture line holds no visible text. */
const isBlank = (line: string) =>
  line
    .replace(/<[^>]*>/g, '')
    .replace(/&#160;|&nbsp;/g, ' ')
    .trim() === ''

/** The text of a capture line, tags dropped and entities left as they are. */
const textOf = (line: string) => line.replace(/<[^>]*>/g, '')

/**
 * Where a showcase starts: `prompt`, the first prompt the person typed (the
 * welcome banner above it goes); `screen`, the top of the visible screen, for a
 * pane drawn beside the transcript; or a line holding the given text.
 */
export type CropFrom = 'prompt' | 'screen' | { text: string }

const PROMPT = '&#10095; '
const RULE = '&#9472;&#9472;&#9472;'

/**
 * Keeps the part of a capture worth showing: from `from` to the prompt box's
 * lower rule (the mode line below it goes), without the hint line above the
 * box, and with runs of blank lines folded to one.
 */
export const crop = (capture: string, from: CropFrom, rows: number): string[] => {
  const inner = capture.replace(/^<div style="[^"]*">/, '').replace(/<\/div>\s*$/, '')
  const lines = inner.split('\n')
  const start =
    from === 'screen'
      ? Math.max(lines.length - rows, 0)
      : lines.findIndex(l => textOf(l).includes(from === 'prompt' ? PROMPT : from.text))
  const rules = lines.flatMap((l, i) => (textOf(l).includes(RULE) ? [i] : []))
  const [top, bottom] = rules.slice(-2)
  const kept = lines.slice(Math.max(start, 0), (bottom ?? lines.length - 1) + 1)
  // The line just above the box holds hints (effort, an editor shortcut).
  const hint = top !== undefined ? top - Math.max(start, 0) - 1 : -1
  if (hint >= 0 && !isBlank(kept[hint] ?? '') && from !== 'screen') kept[hint] = ''
  return kept.filter((l, i) => !(isBlank(l) && i > 0 && isBlank(kept[i - 1] ?? '')))
}

/**
 * Puts each non-ASCII character (other than a space or an emoji, which takes two
 * cells) in a box one cell wide. A glyph the font lacks comes from a fallback font
 * with its own width, which would push the rest of its row out of the grid.
 */
export const gridded = (line: string) =>
  line.replace(/(<[^>]*>)|&#(\d+);/g, (match, tag: string | undefined, code: string) => {
    if (tag !== undefined) return tag
    const char = String.fromCodePoint(Number(code))
    if (Number(code) < 0x80 || char === '\u00a0' || /\p{Emoji_Presentation}/u.test(char)) {
      return match
    }
    return `<span class="cell">${match}</span>`
  })

/** A page holding the cropped lines in a terminal-like frame sized to fit them. */
export const page = (lines: string[], columns: number) => {
  const width = Math.ceil(columns * CELL_PX) + PADDING_PX * 2 + MARGIN_PX * 2
  const height = lines.length * LINE_PX + PADDING_PX * 2 + MARGIN_PX * 2
  const html = `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: transparent; }
  .frame {
    margin: ${MARGIN_PX}px; padding: ${PADDING_PX}px; background: ${BACKGROUND};
    border-radius: 12px; box-shadow: 0 8px 28px rgb(0 0 0 / 0.35);
    width: ${Math.ceil(columns * CELL_PX)}px; overflow: hidden;
  }
  .screen {
    font: ${FONT_PX}px/${LINE_PX}px ${FONT}; color: #e6e6e6;
    white-space: pre; font-variant-ligatures: none;
  }
  .screen > div { display: inline; }
  /* Rex's link runs on over the cell padding after it, so no underline. */
  .screen a { color: inherit; text-decoration: none; }
  .cell { display: inline-block; width: 1ch; }
</style>
<div class="frame"><div class="screen">${lines.map(gridded).join('\n')}</div></div>
`
  return { html, width, height }
}

/** Screenshots `htmlPath` at 2x into `pngPath`, the window sized to the page. */
export const screenshot = (htmlPath: string, pngPath: string, width: number, height: number) => {
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      '--force-device-scale-factor=2',
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: 'ignore' },
  )
}

/** Crops, frames and screenshots one capture. */
export const render = (
  capture: string,
  { columns, rows, from }: { columns: number; rows: number; from: CropFrom },
  htmlPath: string,
  pngPath: string,
) => {
  const { html, width, height } = page(crop(capture, from, rows), columns)
  writeFileSync(htmlPath, html)
  screenshot(htmlPath, pngPath, width, height)
}

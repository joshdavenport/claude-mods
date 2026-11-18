// Turns a terminal program's SGR-coloured output into styled runs a `Text`
// can draw: a `Text` refuses control characters, so the escapes can't pass
// through as they are.

export type Style = {
  color?: string
  backgroundColor?: string
  bold?: true
  dimColor?: true
  italic?: true
  underline?: true
  strikethrough?: true
  inverse?: true
}

export type Span = Style & { text: string }
export type Line = Span[]

const NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
const CUBE = [0, 95, 135, 175, 215, 255]

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`

/**
 * An xterm 256-colour index as a colour `Text` takes. The first 16 stay names
 * so they follow the person's terminal palette; the rest are fixed values.
 */
export const xterm = (n: number): string => {
  if (n < 8) return NAMES[n] ?? 'white'
  if (n < 16) return `${NAMES[n - 8] ?? 'white'}Bright`
  if (n < 232) {
    const i = n - 16
    return hex(CUBE[Math.floor(i / 36)] ?? 0, CUBE[Math.floor(i / 6) % 6] ?? 0, CUBE[i % 6] ?? 0)
  }
  const grey = 8 + (n - 232) * 10
  return hex(grey, grey, grey)
}

/** Applies one SGR sequence's parameters to the running style. */
const apply = (style: Style, params: number[]): Style => {
  let next: Style = { ...style }
  for (let i = 0; i < params.length; i++) {
    const p = params[i] ?? 0
    if (p === 0) next = {}
    else if (p === 1) next.bold = true
    else if (p === 2) next.dimColor = true
    else if (p === 3) next.italic = true
    else if (p === 4) next.underline = true
    else if (p === 7) next.inverse = true
    else if (p === 9) next.strikethrough = true
    else if (p === 22) {
      delete next.bold
      delete next.dimColor
    } else if (p === 23) delete next.italic
    else if (p === 24) delete next.underline
    else if (p === 27) delete next.inverse
    else if (p === 29) delete next.strikethrough
    else if (p >= 30 && p <= 37) next.color = xterm(p - 30)
    else if (p >= 90 && p <= 97) next.color = xterm(p - 90 + 8)
    else if (p === 39) delete next.color
    else if (p >= 40 && p <= 47) next.backgroundColor = xterm(p - 40)
    else if (p >= 100 && p <= 107) next.backgroundColor = xterm(p - 100 + 8)
    else if (p === 49) delete next.backgroundColor
    else if (p === 38 || p === 48) {
      const key = p === 38 ? 'color' : 'backgroundColor'
      const mode = params[i + 1]
      if (mode === 5) {
        next[key] = xterm(params[i + 2] ?? 0)
        i += 2
      } else if (mode === 2) {
        next[key] = hex(params[i + 2] ?? 0, params[i + 3] ?? 0, params[i + 4] ?? 0)
        i += 4
      }
    }
  }
  return next
}

const STYLE_KEYS = [
  'color',
  'backgroundColor',
  'bold',
  'dimColor',
  'italic',
  'underline',
  'strikethrough',
  'inverse',
] as const satisfies readonly (keyof Style)[]

const sameStyle = (a: Style, b: Style) => STYLE_KEYS.every(k => a[k] === b[k])

// Paints something on a blank cell, so trailing whitespace carrying it stays.
const isVisibleOnBlank = (s: Style) =>
  s.backgroundColor !== undefined ||
  s.inverse === true ||
  s.underline === true ||
  s.strikethrough === true

/** Drops the padding glow adds to the right of every line. */
const trimEnd = (line: Line): Line => {
  const out = [...line]
  while (out.length > 0) {
    const last = out[out.length - 1]!
    if (isVisibleOnBlank(last)) break
    const text = last.text.trimEnd()
    if (text.length > 0) {
      out[out.length - 1] = { ...last, text }
      break
    }
    out.pop()
  }
  return out
}

const isBlank = (line: Line) => line.every(s => s.text.trim() === '' && !isVisibleOnBlank(s))

// CSI (SGR among them), OSC (hyperlinks, titles) and any other two-byte escape.
// oxlint-disable-next-line no-control-regex -- matching escape bytes is the point
const ESCAPE = /\x1b\[([0-9;:]*)([\x40-\x7e])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[\x40-\x5f]?/g
// What `Text` refuses once the escapes are gone; tab and newline are handled apart.
// oxlint-disable-next-line no-control-regex -- matching control bytes is the point
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g

/** Parses ANSI-coloured text into lines of styled runs, adjacent like runs merged. */
export const parseAnsi = (input: string): Line[] => {
  const lines: Line[] = [[]]
  let style: Style = {}

  const push = (raw: string) => {
    const parts = raw.replace(/\r/g, '').replace(/\t/g, '    ').split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      const text = part.replace(CONTROL, '')
      if (text === '') return
      const line = lines[lines.length - 1]!
      const last = line[line.length - 1]
      if (last && sameStyle(last, style))
        line[line.length - 1] = { ...last, text: last.text + text }
      else line.push({ ...style, text })
    })
  }

  let at = 0
  for (const match of input.matchAll(ESCAPE)) {
    push(input.slice(at, match.index))
    at = match.index + match[0].length
    if (match[2] === 'm') {
      const params = (match[1] ?? '').split(/[;:]/).map(p => (p === '' ? 0 : Number(p)))
      style = apply(style, params)
    }
  }
  push(input.slice(at))

  const trimmed = lines.map(trimEnd)
  while (trimmed.length > 0 && isBlank(trimmed[0]!)) trimmed.shift()
  while (trimmed.length > 0 && isBlank(trimmed[trimmed.length - 1]!)) trimmed.pop()
  return trimmed
}

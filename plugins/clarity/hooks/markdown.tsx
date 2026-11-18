// Our markdown renderer: marked's lexer turns a reply into tokens, and this
// file turns tokens into the surface's elements. A block type we don't draw
// ourselves goes back to the built-in renderer as a <Markdown> of its raw text.
import type { Elements, RenderElement, RenderNode, RenderSurface } from 'claude-code'

import {
  Marked,
  type MarkedToken,
  type Token,
  type Tokens,
  type TokenizerExtension,
} from './vendor/marked.js'
import { headingIcon, labelIcon, readPill, type PillTone } from './vocabulary'

// The palette, sampled from pi-emphasis on Pi's dark theme. These are raw colors made
// for a dark background; a light terminal theme needs its own set. Theme keys
// (`text`, `permission`) still work anywhere a color goes.
const C = {
  heading: '#cd9a22',
  blue: '#69add0',
  lavender: '#a798d7',
  dim: '#7e888e',
  green: '#68b78d',
  red: '#ea7f81',
  ink: '#15171c',
} as const

/** Every color and glyph the renderer draws with. */
export const STYLE = {
  /** Every heading level's color: the line under it is what tells the levels apart. */
  heading: C.heading,
  /**
   * The line under each level, h1 first, repeated to the heading's width. A level
   * past the end of the list gets no line.
   */
  headingRules: [
    { rule: '=', color: C.heading },
    { rule: '-', color: C.heading },
    { rule: '·', color: C.heading },
    { rule: '· ', color: C.dim },
  ],
  bold: C.blue,
  link: C.blue,
  // The built-in renderer's inline code color.
  code: 'permission',
  bullets: ['•', '◦', '▪'],
  marker: C.lavender,
  hr: C.dim,
  marks: { passed: C.green, failed: C.red, arrow: C.lavender, tree: C.dim },
  /** Pill colors by tone: the chip's background and its text. */
  pills: {
    success: { bg: '#254131', fg: C.green },
    error: { bg: '#5b282a', fg: C.red },
    warning: { bg: '#4e2f1b', fg: C.heading },
    danger: { bg: '#e06c75', fg: C.ink },
    mode: { bg: '#56b6c2', fg: C.ink },
    owner: { bg: '#61afef', fg: C.ink },
    neutral: { bg: '#213b49', fg: '#dee0e1' },
  } satisfies Record<PillTone, { bg: string; fg: string }>,
  /** Rounded Nerd Font ends on pills; false draws square chips padded with a space. */
  roundCaps: true,
} as const

type Els = Pick<Elements[RenderSurface], 'Box' | 'Text' | 'Link' | 'Code' | 'Markdown'>
type Ctx = { els: Els; columns: number; depth: number }

type PillToken = { type: 'pill'; raw: string; label: string }
const PILL = /^\[\[([^[\]\n]{1,32})\]\]/

const pillExtension: TokenizerExtension = {
  name: 'pill',
  level: 'inline',
  start: src => {
    const i = src.indexOf('[[')
    return i < 0 ? undefined : i
  },
  tokenizer: src => {
    const match = PILL.exec(src)
    return match?.[1]?.trim() ? { type: 'pill', raw: match[0], label: match[1] } : undefined
  },
}

const marked = new Marked({ gfm: true, extensions: [pillExtension] })

const isPill = (t: Token): t is Token & PillToken => t.type === 'pill'
// marked's Token union includes a Generic token typed loosely; narrowing to the
// known tokens keeps the switches below honest. Custom tokens are handled first.
const known = (t: Token) => t as MarkedToken

/** Draws a reply's markdown as elements, `columns` wide. */
export function renderMarkdown(text: string, els: Els, columns: number): RenderElement {
  const { Box } = els
  return (
    <Box flexDirection="column">
      {blocks(marked.lexer(text), { els, columns, depth: 0 }, false)}
    </Box>
  )
}

function blocks(tokens: Token[], ctx: Ctx, isTight: boolean): RenderNode[] {
  const { Box } = ctx.els
  const out: RenderNode[] = []
  for (const token of tokens) {
    const node = block(token, ctx)
    if (node === null) continue
    out.push(
      out.length > 0 && !isTight ? (
        <Box flexDirection="column" marginTop={1}>
          {node}
        </Box>
      ) : (
        node
      ),
    )
  }
  return out
}

function block(token: Token, ctx: Ctx): RenderNode | null {
  const { Text, Code, Markdown } = ctx.els
  const t = known(token)
  switch (t.type) {
    case 'space':
    case 'def':
    case 'checkbox':
      return null
    case 'heading':
      return heading(t, ctx)
    case 'paragraph':
      return <Text>{inline(t.tokens, ctx)}</Text>
    case 'text':
      return <Text>{t.tokens ? inline(t.tokens, ctx) : marks(t.text, ctx)}</Text>
    case 'list':
      return list(t, ctx)
    case 'code':
      return <Code source={t.text} language={t.lang?.split(/\s/)[0] || undefined} />
    case 'hr':
      return <Text color={STYLE.hr}>{'─'.repeat(Math.max(ctx.columns, 1))}</Text>
    default:
      // Tables, blockquotes, HTML: the built-in renderer, with pills read as plain words.
      return (
        <Markdown
          text={token.raw
            .replace(/\[\[([^[\]\n]{1,32})\]\]/g, (_, label: string) => readPill(label).text)
            .trimEnd()}
        />
      )
  }
}

function heading(t: Tokens.Heading, ctx: Ctx): RenderNode {
  const { Box, Text } = ctx.els
  const rule = STYLE.headingRules[t.depth - 1]
  const icon = headingIcon(plain(t.tokens))
  const width = Math.max(
    1,
    Math.min(cells(`${icon ? `${icon} ` : ''}${plain(t.tokens)}`), ctx.columns),
  )
  const title = (
    <Text bold color={STYLE.heading}>
      {icon ? `${icon} ` : ''}
      {inline(t.tokens, ctx, false)}
    </Text>
  )
  if (!rule) return title
  return (
    <Box flexDirection="column">
      {title}
      <Text color={rule.color}>{repeatTo(rule.rule, width)}</Text>
    </Box>
  )
}

/** A pattern repeated to `width` cells, with no trailing space. */
function repeatTo(pattern: string, width: number): string {
  return pattern
    .repeat(Math.ceil(width / cells(pattern)))
    .slice(0, width)
    .trimEnd()
}

function list(t: Tokens.List, ctx: Ctx): RenderNode {
  const { Box, Text } = ctx.els
  const start = Number(t.start || 1)
  const bullet = STYLE.bullets[ctx.depth % STYLE.bullets.length]!
  const markers = t.items.map((item, i) => {
    if (item.task)
      return {
        text: item.checked ? '☑' : '☐',
        color: item.checked ? STYLE.marks.passed : STYLE.marker,
      }
    return { text: t.ordered ? `${start + i}.` : bullet, color: STYLE.marker }
  })
  const width = Math.max(...markers.map(m => cells(m.text))) + 1
  const inner: Ctx = {
    ...ctx,
    depth: ctx.depth + 1,
    columns: Math.max(ctx.columns - width, 10),
  }
  return (
    <Box flexDirection="column">
      {t.items.map((item, i) => (
        <Box flexDirection="row" marginTop={i > 0 && t.loose ? 1 : 0}>
          <Box width={width} flexShrink={0}>
            <Text color={markers[i]!.color}>{markers[i]!.text}</Text>
          </Box>
          <Box flexDirection="column" flexGrow={1} flexShrink={1}>
            {blocks(item.tokens, inner, !item.loose)}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

/** Inline tokens as Text runs. `isLeading` marks the first token of a block, where a bold label takes its icon. */
function inline(tokens: Token[], ctx: Ctx, isLeading = true): RenderNode[] {
  return tokens.flatMap((token, i) => inlineToken(token, ctx, isLeading && i === 0))
}

function inlineToken(token: Token, ctx: Ctx, isLeading: boolean): RenderNode[] {
  const { Text, Link } = ctx.els
  if (isPill(token)) return pill(token.label, ctx)
  const t = known(token)
  switch (t.type) {
    case 'text':
      return t.tokens ? inline(t.tokens, ctx, isLeading) : marks(t.text, ctx)
    case 'escape':
    case 'html':
      return [t.text]
    case 'strong': {
      const icon = labelIcon(plain(t.tokens), isLeading)
      return [
        <Text bold color={STYLE.bold}>
          {icon ? `${icon} ` : ''}
          {inline(t.tokens, ctx, false)}
        </Text>,
      ]
    }
    case 'em':
      return [<Text italic>{inline(t.tokens, ctx, false)}</Text>]
    case 'del':
      return [<Text strikethrough>{inline(t.tokens, ctx, false)}</Text>]
    case 'codespan':
      return [<Text color={STYLE.code}>{t.text}</Text>]
    case 'link':
      return [
        <Link href={t.href}>
          <Text color={STYLE.link} underline>
            {inline(t.tokens, ctx, false)}
          </Text>
        </Link>,
      ]
    case 'image':
      return [
        <Link href={t.href}>
          <Text color={STYLE.link} underline>
            {t.text || t.href}
          </Text>
        </Link>,
      ]
    case 'br':
      return ['\n']
    default:
      return [token.raw]
  }
}

const MARKS = /([✓✔]|[✗✘]|→|[├└]──|│)/

/** Plain text with check marks, arrows and tree lines colored. */
function marks(text: string, ctx: Ctx): RenderNode[] {
  const { Text } = ctx.els
  return text
    .split(MARKS)
    .filter(Boolean)
    .map(part => {
      if (/^[✓✔]$/.test(part)) return <Text color={STYLE.marks.passed}>{part}</Text>
      if (/^[✗✘]$/.test(part)) return <Text color={STYLE.marks.failed}>{part}</Text>
      if (part === '→') return <Text color={STYLE.marks.arrow}>{part}</Text>
      if (MARKS.test(part)) return <Text color={STYLE.marks.tree}>{part}</Text>
      return part
    })
}

function pill(label: string, ctx: Ctx): RenderNode[] {
  const { Text } = ctx.els
  const { icon, text, tone } = readPill(label)
  const { bg, fg } = STYLE.pills[tone]
  // No-break spaces keep a two-word pill on one row when the paragraph wraps.
  const body = `${icon ? `${icon} ` : ''}${text}`.replace(/ /g, ' ')
  if (!STYLE.roundCaps) {
    return [<Text bold backgroundColor={bg} color={fg}>{` ${body} `}</Text>]
  }
  return [
    <Text color={bg}>{''}</Text>,
    <Text bold backgroundColor={bg} color={fg}>
      {body}
    </Text>,
    <Text color={bg}>{''}</Text>,
  ]
}

/** The text of inline tokens with all markup dropped. */
function plain(tokens: Token[]): string {
  return tokens
    .map(token => {
      if (isPill(token)) return readPill(token.label).text
      const t = known(token)
      if ('tokens' in t && t.tokens) return plain(t.tokens)
      return 'text' in t ? t.text : ''
    })
    .join('')
}

/** Terminal cells a string takes: wide East Asian characters and emoji take two, combining marks none. */
export function cells(text: string): number {
  let n = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c < 0x20 || (c >= 0x300 && c <= 0x36f) || c === 0x200d || (c >= 0xfe00 && c <= 0xfe0f))
      continue
    const isWide =
      (c >= 0x1100 && c <= 0x115f) ||
      (c >= 0x2e80 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe4f) ||
      (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) ||
      (c >= 0x1f300 && c <= 0x1faff) ||
      (c >= 0x20000 && c <= 0x3fffd)
    n += isWide ? 2 : 1
  }
  return n
}

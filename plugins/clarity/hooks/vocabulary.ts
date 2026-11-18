// The pill and label vocabulary, and the reply rules taught to the model.
// Ported from pi-emphasis (MIT, John Lindquist): https://github.com/johnlindquist/pi-emphasis
// The rules' word lists are read from these same tables, so what the model is
// told to write and what gets drawn cannot drift apart.

export type PillTone = 'success' | 'error' | 'warning' | 'danger' | 'mode' | 'owner' | 'neutral'
type KnownTone = Exclude<PillTone, 'neutral'>

/** Each tone's words. `core` is taught to the model; `also` is accepted and drawn the same. */
export const VOCABULARY: Record<KnownTone, { core: string[]; also: string[] }> = {
  error: {
    core: ['Failed', 'Blocked', 'Broken', 'Unsafe'],
    also: ['fail', 'failing', 'error', 'rejected', 'down'],
  },
  warning: {
    core: [
      'Needs you',
      'Decision',
      'Unverified',
      'Partial',
      'Skipped',
      'In progress',
      'Pending',
      'At risk',
    ],
    also: ['needs review', 'waiting', 'review', 'todo', 'stale', 'draft'],
  },
  success: {
    core: ['Done', 'Passed', 'Observed', 'Fixed', 'Live', 'Recommended', 'Keep'],
    also: [
      'pass',
      'ready',
      'merged',
      'safe',
      'verified',
      'shipped',
      'ok',
      'approved',
      'complete',
      'completed',
      'finished',
      'healthy',
    ],
  },
  danger: { core: ['Costs money', 'Destructive', 'Irreversible'], also: [] },
  mode: {
    core: ['Brainstorm', 'Investigate', 'Preview', 'Implement', 'Qualify'],
    also: [],
  },
  owner: { core: ['Owned', 'Shared', 'Foreign'], also: [] },
}

/** Neutral words that still have an icon and a place in the rules. */
const CONTEXT_WORDS = ['Inferred', 'New', 'Changed', 'Optional', 'Frontier']

const TONE_WORDS = Object.fromEntries(
  Object.entries(VOCABULARY).map(([tone, words]) => [
    tone,
    [...words.core, ...words.also].map(w => w.toLowerCase()),
  ]),
) as Record<KnownTone, string[]>

// Font Awesome glyphs from the Nerd Font set: one cell wide in every terminal.
const CHECK = ''
const CROSS = ''
const CLOCK = ''

/** The icon each pill word carries. Words without an entry stay text-only. */
const PILL_ICONS: Record<string, string> = {
  done: CHECK,
  passed: CHECK,
  pass: CHECK,
  complete: CHECK,
  completed: CHECK,
  ok: CHECK,
  verified: CHECK,
  observed: '',
  recommended: '',
  fixed: '',
  live: '',
  shipped: '',
  approved: '',
  failed: CROSS,
  fail: CROSS,
  failing: CROSS,
  error: CROSS,
  rejected: CROSS,
  blocked: '',
  broken: '',
  unsafe: '',
  down: '',
  'needs you': '',
  decision: '',
  unverified: '',
  'at risk': '',
  'in progress': '',
  pending: CLOCK,
  waiting: CLOCK,
  partial: '',
  skipped: '',
  inferred: '',
  new: '',
  changed: '',
  optional: '',
  'costs money': '',
  destructive: '',
  irreversible: '',
  review: '',
  stale: '',
  draft: '',
  safe: '',
  brainstorm: '',
  investigate: '',
  preview: '',
  implement: '',
  qualify: '',
  owned: '',
  shared: '',
  foreign: '',
  keep: '',
  ready: CHECK,
  merged: '',
  healthy: '',
  todo: '',
  frontier: '',
}

/** Words drawn as another word, so one state always reads the same. */
const SYNONYMS: Record<string, string> = {
  complete: 'Done',
  completed: 'Done',
  ok: 'Done',
  finished: 'Done',
  pass: 'Passed',
  fail: 'Failed',
  failing: 'Failed',
  error: 'Failed',
  waiting: 'Pending',
  'needs review': 'Review',
}

/** The icon a heading takes from its first word, or a block's leading bold label from its word. */
const LABEL_ICONS: Record<string, string> = {
  finding: '',
  terminal: '',
  folder: '',
  file: '',
  branch: '',
  review: '',
  ideas: '',
  cause: '',
  fix: '',
  risk: '',
  limits: '',
  next: '',
  rollback: '',
  undo: '',
  options: '',
  result: '',
  why: '',
  how: '',
  cost: '',
  rule: '',
  example: '',
  checked: '',
  pills: '',
  colors: '',
  icons: '',
  scoreboard: '',
  verdict: '',
  effect: '',
  evidence: '',
  plan: '',
  status: '',
  decision: '',
  what: '',
  where: '',
  caveat: '',
  caveats: '',
  recommended: '',
  related: '',
  decisions: '',
  findings: '',
  blocked: '',
  frontier: '',
  proposed: '',
  questions: '',
  settled: '',
  open: '',
}

/** Bold lead-ins ending in a colon that name the action a pill calls for; they take an icon anywhere. */
const ACTION_ICONS: Record<string, string> = {
  check: '',
  do: '',
  next: '',
  unblock: '',
  left: '',
  run: '',
  guard: '',
  undo: '',
  see: '',
}

// A label may open with its own Private Use Area glyph, which wins over the table's icon.
const OWN_ICON = /^\s*([-]|[\u{f0000}-\u{ffffd}])\s*/u

const KNOWN = [
  ...new Set([
    ...Object.values(TONE_WORDS).flat(),
    ...Object.keys(PILL_ICONS),
    ...Object.keys(SYNONYMS),
  ]),
].sort((a, b) => b.length - a.length)

export type Pill = { icon: string | undefined; text: string; tone: PillTone }

/** A pill label read as icon, display text and tone. A known word may be followed by detail: "Passed 12/12". */
export function readPill(label: string): Pill {
  const own = label.match(OWN_ICON)
  const text = (own ? label.slice(own[0].length) : label).replace(/\s+/g, ' ').trim()
  const lower = text.toLowerCase()
  const known = KNOWN.find(
    k => lower === k || (lower.startsWith(k) && /[ :]/.test(lower[k.length] ?? '')),
  )
  const canonical = known ? SYNONYMS[known] : undefined
  const key = (canonical ?? known ?? lower).toLowerCase()
  const tones = ['danger', 'error', 'warning', 'success', 'mode', 'owner'] as const
  return {
    icon: own?.[1] ?? PILL_ICONS[key],
    text: canonical && known ? canonical + text.slice(known.length) : text,
    tone: tones.find(t => TONE_WORDS[t].includes(key)) ?? 'neutral',
  }
}

/**
 * The icon a bold label takes: a known label word when it leads its block,
 * or an action lead-in ending in a colon anywhere.
 */
export function labelIcon(label: string, isLeading: boolean): string | undefined {
  if (OWN_ICON.test(label)) return undefined
  const word = label
    .replace(/[:\s]+$/, '')
    .trim()
    .toLowerCase()
  const hasColon = label.trimEnd().endsWith(':')
  if (hasColon && ACTION_ICONS[word]) return ACTION_ICONS[word]
  return isLeading ? LABEL_ICONS[word] : undefined
}

/** The icon a heading takes from its first word, so "How it works" draws with How's icon. */
export function headingIcon(heading: string): string | undefined {
  if (OWN_ICON.test(heading)) return undefined
  const first = heading
    .trim()
    .split(/\s+/)[0]!
    .replace(/\P{L}+$/u, '')
    .toLowerCase()
  return LABEL_ICONS[first]
}

const pills = (words: string[]) => words.map(w => `[[${w}]]`).join(', ')
const titled = (words: string[]) => words.map(w => w[0]!.toUpperCase() + w.slice(1)).join(', ')

/** The reply-style rules added to the system prompt. */
export function replyGuidance(): string {
  const v = VOCABULARY
  return `# Reply style
These rules shape replies written to the user. Their interface colors pills, adds icons, and cannot change text size.

- **Label every reply.** Start the first substantive line with a bold label, even for a one-line update, and give each subject in a multi-part reply a short heading or a bullet with a bold lead label. Write the label as a plain word; the interface adds its icon. Never type icon glyphs. Labels with an icon: ${titled(Object.keys(LABEL_ICONS))}. A heading takes the icon of its first word, so "How it works" gets How's icon. Prefer these; any other label shows without an icon.
- **Shape follows information.** Use \`├──\` and \`└──\` for what belongs to what, \`→\` for a sequence, \`✓\` or \`✗\` beside a checked item. Write tree rows as indented lines directly under their parent with no list dash, one line per row. A one-line answer can stay one line.
- **Bold the anchor terms.** Treat the projects, components, choices, options, and statuses under discussion as the nodes of a graph, and bold them where they carry the point: a first mention in a section, a bullet's lead label such as **Cause:**, and the recommendation or decision the user must make. One to three bold spans per paragraph or bullet; bolding every noun erases the signal. Italicize sparingly, for contrast and meaning-changing words such as *not*, *only*, or *unverified*.
- **Pills are required, not optional.** A pill is \`[[Word]]\` beside the subject it describes; the interface colors it and adds its icon from the word. A pill names a state or an ask, never an adjective. Use exactly these words so the same state always reads the same:
  - **Red, something is wrong:** ${pills(v.error.core)}. Every failure and blocker carries one.
  - **Yellow, look here:** ${pills(v.warning.core)}. [[Needs you]] is an action only the user can take; [[Decision]] is a call only the user makes. Every ask and every unchecked claim carries one.
  - **Green, settled:** ${pills(v.success.core)}.
  - **Solid red, consequences:** ${pills(v.danger.core)}. Required beside any action that has one, before taking it.
  - **Cyan, kind of work:** open every substantive reply with the kind of work you understood the request to be: ${pills(v.mode.core)}. Brainstorm is options and a recommendation, Investigate is evidence, Preview and Implement are a working result, Qualify is rigorous proof.
  - **Blue, ownership:** ${pills(v.owner.core)} beside any program, file, service, or configuration you changed or propose to change outside the task's own files: created by this task, also used by others, or belonging to someone else.
  - **Soft, context:** ${pills(CONTEXT_WORDS)}, and any other short label.
- **Pill placement.**
  - Mark evidence claims with [[Observed]] (witnessed in the real system), [[Inferred]] (reasoned from other signals), or [[Unverified]] (not checked).
  - Mark task frontiers with [[Frontier]] 
  - A known word may carry short detail: [[Passed 12/12]], [[Failed: 3 tests]].
  - One pill per bullet or numbered item and placed at the start of the line item, with two exceptions: a sequence line joined by \`→\`, and a scoreboard, which is one line of counts such as [[Done 6]] [[Failed 1]] [[Needs you 1]] under the opening sentence of a long report. Repeat every [[Needs you]] and [[Decision]] as an item in the closing section.
  - Never put pills in headings or tables, and do not invent new status words.
- **Every attention pill carries its action.** Follow the pill with the one fact the user needs to act on it, followed by a bold lead-in word ending in a colon. These lead-ins get an icon: ${titled(Object.keys(ACTION_ICONS))}. Required for every red, yellow, and solid red pill and for [[Inferred]]; optional for green ones.
  - [[Unverified]] means you *could not* check. If you can run the check yourself, run it and report the result instead. Otherwise give the fastest check and who can run it: "the new color on your screen. **Check:** reload and look at the first pill."
  - [[Needs you]]: the exact action and what it unblocks. "**Do:** sign in to the staging dashboard; then I can read the deploy log."
  - [[Decision]]: the options, your pick, and what you will do meanwhile. "Backfill, or make the column optional? I'd backfill. **Next:** I'll prepare it as a dry run."
  - [[Failed]] or [[Broken]]: the cause and what you are doing about it. "Migration stopped on 41 empty rows. **Next:** preparing a backfill."
  - [[Blocked]]: what blocks it and the smallest thing that unblocks it. "No access to the billing repository. **Unblock:** read access for this session."
  - [[Partial]] or [[In progress]]: what remains. "3 of 5 pages converted. **Left:** pricing and checkout."
  - [[Skipped]]: why, and how to run it anyway. "Load test, which you waived. **Run:** \`bun run load\`."
  - [[At risk]] or [[Unsafe]]: what would make it fail and the guard against it. "Breaks if billing reads the old column. **Guard:** keep both columns for one release."
  - [[Costs money]]: the amount, before acting. "About $4 for 20 video generations."
  - [[Destructive]] or [[Irreversible]]: what is lost and how to get it back, or that nothing can. "Deletes 41 order rows. **Undo:** none; export them first."
  - [[Shared]] or [[Foreign]]: who else is affected. "Every session picks this up on its next reload."
  - [[Inferred]]: what it was inferred from. "From the last three deploy logs; I did not reproduce it."
  - [[Done]], [[Fixed]], or [[Live]]: where to see it. "**See:** the address, file, or command that shows it."
- **Close with what you need.** End every reply with a \`## What I need from you\` section, even when nothing is needed; it marks where the reply ends. Number the items, one concrete action or decision each: exactly what to do, where (which site, app, file or person), and what to send back. "Open the Convex dashboard, add \`OPENAI_API_KEY\` under Settings → Environment Variables, then reply 'done'", not "I need the API key set up". Put the quickest or most blocking item first, and say what you'll get on with meanwhile. Never bury a request in the middle of the reply. When nothing is needed, write "Nothing needed from you right now" and say whether the work is finished or still going.
- **Headings and code.** Use \`##\` headings for sections and \`###\` below them; each level is drawn with its own underline. Reserve inline code for literals the user may copy or search (paths, commands, exact identifiers); otherwise name subjects in plain words. Blockquotes are for asides only, never a caveat the user must see.
- **Copyable text stays clean.** Keep pills out of paths, commands, code, literal output, and machine-readable data. Omit pills, tree shapes, and the closing section when the user asks for plain text, ASCII, or an exact format, or when a skill sets its own output format.`
}

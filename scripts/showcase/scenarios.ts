// What each mod's showcase does: the demo folder's files, then the prompts that
// bring the feature on screen.

import type { CropFrom } from './render.ts'

/**
 * `prompt`: typed and submitted. `click`: a mouse click on the first place the
 * screen shows that text, such as a button's label. Each waits for the screen to settle.
 */
export type Step = { prompt: string } | { click: string }

export type Scenario = {
  mod: string
  columns: number
  rows: number
  permissionMode?: 'default' | 'acceptEdits'
  /** Where the image starts; `prompt` when left out. */
  cropFrom?: CropFrom
  /** Files written into the demo folder, keyed by relative path. */
  files?: Record<string, string>
  steps: Step[]
}

const noTools = "Don't use any tools."

// A small project skill for the skill mods to act on.
const releaseNotesSkill = `---
name: release-notes
description: Drafts release notes for the next version
---

Draft release notes for version 2.4.0 of a todo app from these changes:

- Added due dates to todos
- Fixed a crash when a list was empty
- Sped up search on large lists

Keep it under 80 words. ${noTools}
`

export const scenarios: Scenario[] = [
  {
    mod: 'clarity',
    columns: 100,
    rows: 50,
    steps: [
      {
        prompt: `Pretend we just moved this app's build from webpack to Vite. Give me a short status report: two steps done, one test that failed and why, one risk, and the decision I need to make about legacy browser support. ${noTools}`,
      },
    ],
  },
  {
    mod: 'grill-q-prompt',
    columns: 100,
    rows: 40,
    steps: [
      {
        prompt: `Grill me on my plan to add a dark mode toggle to a web app. Ask exactly three questions in one round, each on its own line as ❓ **Q1** - **Topic**: question (Q2, Q3 for the others), then stop. ${noTools}`,
      },
    ],
  },
  {
    mod: 'md-glow',
    columns: 150,
    // Short enough that the welcome banner has scrolled away, so the screen's top
    // (where the pane starts) is the conversation.
    rows: 30,
    cropFrom: 'screen',
    permissionMode: 'acceptEdits',
    steps: [
      {
        prompt:
          'Use the Write tool to create NOTES.md: a short guide to a CLI called tally that counts words in files, with a title, a one-line description, an install section with a code block, and a usage table with three flags. Then reply with one short sentence.',
      },
      { click: 'View with glow' },
    ],
  },
  {
    mod: 'skill-augment',
    columns: 100,
    rows: 40,
    // Claude Code draws the mod's log rows above the prompt that set them off.
    cropFrom: { text: 'skill-augment: Augmented' },
    files: {
      '.claude/skills/release-notes/SKILL.md': releaseNotesSkill,
      '.claude/skills-augment/house-style.md': `---
skills: [release-notes]
---

Write in British English, and end with a one-line "Thanks" to contributors.
`,
    },
    steps: [{ prompt: '/release-notes' }],
  },
  {
    mod: 'skill-prompt-view',
    columns: 100,
    rows: 40,
    files: { '.claude/skills/release-notes/SKILL.md': releaseNotesSkill },
    steps: [{ prompt: '/release-notes' }],
  },
]

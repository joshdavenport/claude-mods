/** One skill expansion, as the model read it. */
export type Expansion = {
  /** The placed row's id. */
  id: string
  skill: string
  text: string
  isHidden: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'skill-prompt-view': { expansions: Shaped<Expansion[]> }
  }
}

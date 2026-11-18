/** A markdown file a Write or Edit touched this session. */
export type MdFile = { path: string; writtenAt: number }

declare module 'claude-code' {
  interface PluginState {
    'md-glow': {
      /** Every markdown file written this session, most recent last. */
      files: Shaped<MdFile[]>
      /** The file the band above the prompt offers; null hides the band. */
      offer: string | null
      /** The file the pane shows. */
      viewing: string | null
    }
  }
}

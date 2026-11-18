import type { Register } from 'claude-code'

import { renderMarkdown } from './markdown'
import { replyGuidance } from './vocabulary'

// The assistant row's bullet and its gap sit left of the text.
const GUTTER = 2

export const register: Register = on => {
  // The rules travel with the renderer. A run nothing draws (print, SDK) isn't taught pills.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (e.surfaces.length === 0) return composed
    return {
      sections: [
        ...composed.sections,
        { id: 'clarity:reply-style', text: replyGuidance(), scope: 'session' },
      ],
    }
  })

  // Display only: the stored message keeps its markdown (ctrl+o shows it).
  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    if (e.props.isSummary) return next(e)
    const els = $.ui.resolve(e)
    const body = renderMarkdown(e.props.text, els, (e.viewport?.columns ?? 80) - GUTTER)
    if (e.surface !== 'terminal') return body
    // Our tree replaces the whole row, so the terminal's gap, bullet and indent are redrawn here.
    const { Box, Text } = els
    return (
      <Box flexDirection="row" marginTop={1}>
        <Box width={GUTTER} flexShrink={0}>
          <Text>{e.props.isFirstOfReply ? '⏺' : ' '}</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
          {body}
        </Box>
      </Box>
    )
  }).catch(($, e, next) => next(e))
}

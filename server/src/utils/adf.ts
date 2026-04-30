export interface AdfTextNode {
  type: 'text'
  text: string
}

export interface AdfParagraphNode {
  type: 'paragraph'
  content: AdfTextNode[]
}

export interface AdfDoc {
  type: 'doc'
  version: 1
  content: AdfParagraphNode[]
}

export function buildAdfComment(text: string): AdfDoc {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: text.trim() ? [{ type: 'text', text: text.trim() }] : [],
      },
    ],
  }
}

export function extractPlainTextFromAdf(doc: unknown): string {
  try {
    if (!doc || typeof doc !== 'object') return ''
    const d = doc as Record<string, unknown>
    if (d.type !== 'doc' || !Array.isArray(d.content)) return ''

    const parts: string[] = []
    for (const block of d.content) {
      if (!block || typeof block !== 'object') continue
      const b = block as Record<string, unknown>
      if (!Array.isArray(b.content)) continue
      for (const inline of b.content) {
        if (!inline || typeof inline !== 'object') continue
        const i = inline as Record<string, unknown>
        if (i.type === 'text' && typeof i.text === 'string') {
          parts.push(i.text)
        }
      }
    }
    return parts.join('')
  } catch {
    return ''
  }
}

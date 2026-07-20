export interface AdfMark {
  type: 'strong' | 'em' | 'code'
}

export interface AdfTextNode {
  type: 'text'
  text: string
  marks?: AdfMark[]
}

export interface AdfParagraphNode {
  type: 'paragraph'
  content: AdfTextNode[]
}

export interface AdfHeadingNode {
  type: 'heading'
  attrs: { level: number }
  content: AdfTextNode[]
}

export interface AdfBulletListNode {
  type: 'bulletList'
  content: AdfListItemNode[]
}

export interface AdfOrderedListNode {
  type: 'orderedList'
  content: AdfListItemNode[]
}

export interface AdfListItemNode {
  type: 'listItem'
  content: AdfParagraphNode[]
}

export interface AdfTableCellNode {
  type: 'tableHeader' | 'tableCell'
  attrs: Record<string, unknown>
  content: AdfParagraphNode[]
}

export interface AdfTableRowNode {
  type: 'tableRow'
  content: AdfTableCellNode[]
}

export interface AdfTableNode {
  type: 'table'
  attrs: {
    isNumberColumnEnabled: boolean
    layout: 'default'
  }
  content: AdfTableRowNode[]
}

export type AdfBlockNode =
  | AdfParagraphNode
  | AdfHeadingNode
  | AdfBulletListNode
  | AdfOrderedListNode
  | AdfTableNode

export interface AdfDoc {
  type: 'doc'
  version: 1
  content: AdfBlockNode[]
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

function parseInlineMarkdown(text: string): AdfTextNode[] {
  const nodes: AdfTextNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }

    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push({
        type: 'text',
        text: token.slice(2, -2),
        marks: [{ type: 'strong' }],
      })
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push({
        type: 'text',
        text: token.slice(1, -1),
        marks: [{ type: 'em' }],
      })
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push({
        type: 'text',
        text: token.slice(1, -1),
        marks: [{ type: 'code' }],
      })
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return nodes.length > 0 ? nodes : []
}

function paragraph(text: string): AdfParagraphNode {
  return {
    type: 'paragraph',
    content: text.trim() ? parseInlineMarkdown(text.trim()) : [],
  }
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function tableCell(text: string, header: boolean): AdfTableCellNode {
  return {
    type: header ? 'tableHeader' : 'tableCell',
    attrs: {},
    content: [paragraph(text)],
  }
}

/**
 * Converts a subset of Markdown (headings, paragraphs, lists, tables, bold/italic/code)
 * into Atlassian Document Format for Jira description fields.
 */
export function markdownToAdf(markdown: string): AdfDoc {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const content: AdfBlockNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      content.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: parseInlineMarkdown(headingMatch[2]),
      })
      i += 1
      continue
    }

    // GFM table: header | --- | body rows
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1].trim())
    ) {
      const headerCells = splitTableRow(trimmed)
      const rows: AdfTableRowNode[] = [
        {
          type: 'tableRow',
          content: headerCells.map((cell) => tableCell(cell, true)),
        },
      ]
      i += 2
      while (i < lines.length) {
        const rowTrimmed = lines[i].trim()
        if (!rowTrimmed.includes('|')) break
        if (isTableSeparator(rowTrimmed)) {
          i += 1
          continue
        }
        const cells = splitTableRow(rowTrimmed)
        while (cells.length < headerCells.length) cells.push('')
        rows.push({
          type: 'tableRow',
          content: cells.slice(0, headerCells.length).map((cell) => tableCell(cell, false)),
        })
        i += 1
      }
      content.push({
        type: 'table',
        attrs: { isNumberColumnEnabled: false, layout: 'default' },
        content: rows,
      })
      continue
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (bulletMatch) {
      const items: AdfListItemNode[] = []
      while (i < lines.length) {
        const itemTrimmed = lines[i].trim()
        const itemMatch = itemTrimmed.match(/^[-*]\s+(.+)$/)
        if (!itemMatch) break
        items.push({
          type: 'listItem',
          content: [paragraph(itemMatch[1])],
        })
        i += 1
      }
      content.push({ type: 'bulletList', content: items })
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      const items: AdfListItemNode[] = []
      while (i < lines.length) {
        const itemTrimmed = lines[i].trim()
        const itemMatch = itemTrimmed.match(/^\d+\.\s+(.+)$/)
        if (!itemMatch) break
        items.push({
          type: 'listItem',
          content: [paragraph(itemMatch[1])],
        })
        i += 1
      }
      content.push({ type: 'orderedList', content: items })
      continue
    }

    const paragraphLines: string[] = [trimmed]
    i += 1
    while (i < lines.length) {
      const next = lines[i].trim()
      if (
        !next ||
        /^(#{1,6})\s+/.test(next) ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        (next.includes('|') &&
          i + 1 < lines.length &&
          isTableSeparator(lines[i + 1].trim()))
      ) {
        break
      }
      paragraphLines.push(next)
      i += 1
    }
    content.push(paragraph(paragraphLines.join(' ')))
  }

  if (content.length === 0) {
    content.push({ type: 'paragraph', content: [] })
  }

  return { type: 'doc', version: 1, content }
}

export function extractPlainTextFromAdf(doc: unknown): string {
  return adfToMarkdown(doc)
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function inlineToMarkdown(nodes: unknown[]): string {
  const parts: string[] = []
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const n = node as Record<string, unknown>
    if (n.type !== 'text' || typeof n.text !== 'string') continue
    let text = n.text
    const marks = Array.isArray(n.marks) ? n.marks : []
    const markTypes = new Set(
      marks
        .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
        .map((m) => String(m.type ?? '')),
    )
    if (markTypes.has('code')) text = `\`${text}\``
    if (markTypes.has('strong')) text = `**${text}**`
    if (markTypes.has('em')) text = `*${text}*`
    parts.push(text)
  }
  return parts.join('')
}

/**
 * Best-effort ADF → Markdown for editable Description/Valor fields.
 */
export function adfToMarkdown(doc: unknown): string {
  try {
    if (!doc || typeof doc !== 'object') return typeof doc === 'string' ? doc : ''
    if (typeof doc === 'string') return doc
    const d = doc as Record<string, unknown>
    if (d.type !== 'doc' || !Array.isArray(d.content)) return ''

    const lines: string[] = []

    const renderBlocks = (blocks: unknown[]): void => {
      for (const block of blocks) {
        if (!block || typeof block !== 'object') continue
        const b = block as Record<string, unknown>
        const type = String(b.type ?? '')
        const content = Array.isArray(b.content) ? b.content : []

        if (type === 'heading') {
          const level = Math.min(
            6,
            Math.max(1, Number((b.attrs as { level?: number } | undefined)?.level ?? 1)),
          )
          lines.push(`${'#'.repeat(level)} ${inlineToMarkdown(content)}`)
          lines.push('')
          continue
        }

        if (type === 'paragraph') {
          const text = inlineToMarkdown(content)
          lines.push(text)
          lines.push('')
          continue
        }

        if (type === 'bulletList' || type === 'orderedList') {
          let index = 1
          for (const item of content) {
            if (!item || typeof item !== 'object') continue
            const li = item as Record<string, unknown>
            if (li.type !== 'listItem' || !Array.isArray(li.content)) continue
            const para = li.content.find(
              (c) => c && typeof c === 'object' && (c as { type?: string }).type === 'paragraph',
            ) as { content?: unknown[] } | undefined
            const text = inlineToMarkdown(para?.content ?? [])
            lines.push(type === 'bulletList' ? `- ${text}` : `${index}. ${text}`)
            index += 1
          }
          lines.push('')
          continue
        }

        if (type === 'table' && Array.isArray(b.content)) {
          let rowIndex = 0
          for (const row of b.content) {
            if (!row || typeof row !== 'object') continue
            const r = row as Record<string, unknown>
            if (r.type !== 'tableRow' || !Array.isArray(r.content)) continue
            const cells: string[] = []
            for (const cell of r.content) {
              if (!cell || typeof cell !== 'object') continue
              const c = cell as Record<string, unknown>
              if (!Array.isArray(c.content)) {
                cells.push('')
                continue
              }
              const cellText = c.content
                .map((child) => {
                  if (!child || typeof child !== 'object') return ''
                  const ch = child as Record<string, unknown>
                  if (ch.type === 'paragraph' && Array.isArray(ch.content)) {
                    return inlineToMarkdown(ch.content)
                  }
                  return ''
                })
                .filter(Boolean)
                .join(' ')
              cells.push(cellText)
            }
            lines.push(`| ${cells.join(' | ')} |`)
            if (rowIndex === 0) {
              lines.push(`| ${cells.map(() => '---').join(' | ')} |`)
            }
            rowIndex += 1
          }
          lines.push('')
        }
      }
    }

    renderBlocks(d.content)
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  } catch {
    return ''
  }
}


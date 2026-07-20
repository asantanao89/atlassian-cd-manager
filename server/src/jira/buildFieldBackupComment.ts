export interface FieldBackupInput {
  summary?: string
  description?: string
  acceptanceCriteria?: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local datetime as YYYY-MM-DD HH:mm for the backup comment header. */
export function formatBackupTimestamp(date = new Date()): string {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  )
}

/**
 * Builds Markdown for a single merged field-backup comment.
 * Returns null when no selected field has non-empty content.
 */
export function buildFieldBackupCommentMarkdown(
  backup: FieldBackupInput | undefined | null,
  date = new Date(),
): string | null {
  if (!backup) return null

  const sections: Array<{ title: string; body: string }> = []
  const summary = backup.summary?.trim()
  if (summary) sections.push({ title: 'Summary', body: summary })

  const description = backup.description?.trim()
  if (description) sections.push({ title: 'Description', body: description })

  const acceptance = backup.acceptanceCriteria?.trim()
  if (acceptance) sections.push({ title: 'Criterios de aceptación', body: acceptance })

  if (sections.length === 0) return null

  const parts = [`Backup de campos modificados (${formatBackupTimestamp(date)})`, '']
  for (const section of sections) {
    parts.push(`## ${section.title}`, '', section.body, '')
  }
  return parts.join('\n').trimEnd() + '\n'
}

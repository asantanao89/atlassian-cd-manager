export interface SprintChangelogItem {
  field?: string
  fieldId?: string
  from?: string | null
  to?: string | null
}

export interface SprintChangelogEntry {
  created: string
  items: SprintChangelogItem[]
}

function sprintIds(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  return value.split(',').map((id) => id.trim()).filter(Boolean)
}

function isSprintField(item: SprintChangelogItem): boolean {
  return item.fieldId === 'customfield_10020' || item.field === 'Sprint'
}

export function sprintAddedAt(
  created: string,
  histories: SprintChangelogEntry[],
): string {
  const ordered = [...histories].sort((a, b) => Date.parse(a.created) - Date.parse(b.created))

  for (const history of ordered) {
    for (const item of history.items) {
      if (!isSprintField(item)) continue
      const from = sprintIds(item.from)
      const to = sprintIds(item.to)
      if (from.length === 0 && to.length > 0) return history.created
      if (from.length > 0) return created
    }
  }

  return created
}

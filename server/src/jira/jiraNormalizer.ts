import { extractPlainTextFromAdf } from '../utils/adf'
import { CDT_TICKETS_CONFIG } from './cdtTicketsConfig'
import { extractSprintName } from './normalizeCdtTicket'

export interface NormalizedIssue {
  id: string
  key: string
  summary: string
  issueType: string
  statusName: string
  assigneeName: string | null
  parentKey: string | null
  parentSummary: string | null
  parentStatusName: string | null
  parentStatusCategoryKey: string | null
  parentStatusColorName: string | null
  parentIssueType: string | null
  created: string
  updated: string
  sprintName: string
  components: string[]
  labels: string[]
  timetracking: {
    originalEstimate?: string
    remainingEstimate?: string
    timeSpent?: string
    originalEstimateSeconds?: number
    remainingEstimateSeconds?: number
    timeSpentSeconds?: number
  }
  subtaskKeys: string[]
}

export interface NormalizedIssueWithWorklogs extends NormalizedIssue {
  worklogs: NormalizedWorklog[]
}

export interface NormalizedWorklog {
  id: string
  issueId: string
  authorDisplayName: string
  updateAuthorDisplayName: string
  started: string
  updated: string
  timeSpent: string
  timeSpentSeconds: number
  commentText: string
}

export function normalizeIssue(raw: unknown): NormalizedIssue {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid issue data')
  const r = raw as Record<string, unknown>
  const fields = (r.fields ?? {}) as Record<string, unknown>
  const tt = (fields.timetracking ?? {}) as Record<string, unknown>
  const assignee = fields.assignee as Record<string, unknown> | null | undefined
  const parent = fields.parent as Record<string, unknown> | null | undefined
  const parentFields = (parent?.fields ?? null) as Record<string, unknown> | null
  const parentSummary =
    parentFields && typeof parentFields.summary === 'string' && parentFields.summary.trim().length > 0
      ? parentFields.summary
      : null
  const parentStatus = parentFields?.status as Record<string, unknown> | undefined
  const parentStatusName =
    parentStatus && typeof parentStatus.name === 'string' && parentStatus.name.trim().length > 0
      ? parentStatus.name
      : null
  const parentStatusCategory = parentStatus?.statusCategory as Record<string, unknown> | undefined
  const parentStatusCategoryKey =
    parentStatusCategory && typeof parentStatusCategory.key === 'string' && parentStatusCategory.key.trim().length > 0
      ? parentStatusCategory.key
      : null
  const parentStatusColorName =
    parentStatusCategory && typeof parentStatusCategory.colorName === 'string' && parentStatusCategory.colorName.trim().length > 0
      ? parentStatusCategory.colorName
      : null
  const parentIssueTypeRaw = parentFields?.issuetype as Record<string, unknown> | undefined
  const parentIssueType =
    parentIssueTypeRaw && typeof parentIssueTypeRaw.name === 'string' && parentIssueTypeRaw.name.trim().length > 0
      ? parentIssueTypeRaw.name
      : null
  const status = fields.status as Record<string, unknown> | undefined
  const issuetype = fields.issuetype as Record<string, unknown> | undefined
  const subtasks = (fields.subtasks ?? []) as Array<Record<string, unknown>>
  const componentsRaw = Array.isArray(fields.components) ? fields.components : []
  const components = componentsRaw
    .map((component) => {
      if (!component || typeof component !== 'object') return ''
      return String((component as { name?: unknown }).name ?? '').trim()
    })
    .filter(Boolean)
  const labelsRaw = Array.isArray(fields.labels) ? fields.labels : []
  const labels = labelsRaw.map((label) => String(label ?? '').trim()).filter(Boolean)

  return {
    id: String(r.id ?? ''),
    key: String(r.key ?? ''),
    summary: String(fields.summary ?? ''),
    issueType: String(issuetype?.name ?? ''),
    statusName: String(status?.name ?? ''),
    assigneeName: assignee ? String(assignee.displayName ?? '') : null,
    parentKey: parent ? String(parent.key ?? '') : null,
    parentSummary,
    parentStatusName,
    parentStatusCategoryKey,
    parentStatusColorName,
    parentIssueType,
    created: String(fields.created ?? ''),
    updated: String(fields.updated ?? ''),
    sprintName: extractSprintName(fields[CDT_TICKETS_CONFIG.sprintField]),
    components,
    labels,
    timetracking: {
      originalEstimate: tt.originalEstimate as string | undefined,
      remainingEstimate: tt.remainingEstimate as string | undefined,
      timeSpent: tt.timeSpent as string | undefined,
      originalEstimateSeconds: tt.originalEstimateSeconds as number | undefined,
      remainingEstimateSeconds: tt.remainingEstimateSeconds as number | undefined,
      timeSpentSeconds: tt.timeSpentSeconds as number | undefined,
    },
    subtaskKeys: subtasks.map((st) => String(st.key ?? '')).filter(Boolean),
  }
}

export function normalizeWorklog(raw: unknown, issueId = ''): NormalizedWorklog {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid worklog data')
  const r = raw as Record<string, unknown>
  const author = r.author as Record<string, unknown> | null | undefined
  const updateAuthor = r.updateAuthor as Record<string, unknown> | null | undefined

  return {
    id: String(r.id ?? ''),
    issueId,
    authorDisplayName: author ? String(author.displayName ?? 'Desconocido') : 'Desconocido',
    updateAuthorDisplayName: updateAuthor
      ? String(updateAuthor.displayName ?? 'Desconocido')
      : 'Desconocido',
    started: String(r.started ?? ''),
    updated: String(r.updated ?? ''),
    timeSpent: String(r.timeSpent ?? ''),
    timeSpentSeconds: Number(r.timeSpentSeconds ?? 0),
    commentText: extractPlainTextFromAdf(r.comment),
  }
}

export function normalizeIssueWithWorklogs(raw: unknown): NormalizedIssueWithWorklogs {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid issue data')

  const baseIssue = normalizeIssue(raw)
  const r = raw as Record<string, unknown>
  const fields = (r.fields ?? {}) as Record<string, unknown>
  const worklogField = (fields.worklog ?? {}) as Record<string, unknown>
  const rawWorklogs = (worklogField.worklogs ?? []) as unknown[]

  return {
    ...baseIssue,
    worklogs: rawWorklogs.map((w) => normalizeWorklog(w, baseIssue.key)),
  }
}

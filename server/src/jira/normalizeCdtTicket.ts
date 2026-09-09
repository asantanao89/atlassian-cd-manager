import { CDT_TICKETS_CONFIG } from './cdtTicketsConfig'
import { adfToMarkdown } from '../utils/adf'

export interface CdtTicket {
  id: string
  key: string
  linkedKey: string
  summary: string
  requestType: string
  reporterName: string
  created: string
  statusName: string
  assigneeName: string
}

export interface CdtTicketDetails extends CdtTicket {
  area: string
  departamento: string
  categoriaCanalDigital: string
  prioridad: string
  un: string
  labels: string
  priority: string
  bl: string
  linkedStatus: string
  description: string
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function stripProjectPrefix(value: string): string {
  const separator = value.lastIndexOf('/')
  if (separator < 0) return value
  return value.slice(separator + 1).trim() || value
}

export function extractRequestTypeName(raw: unknown): string {
  if (raw == null) return ''

  const asString = nonEmptyString(raw)
  if (asString) return stripProjectPrefix(asString)
  if (typeof raw !== 'object') return ''

  const obj = raw as Record<string, unknown>
  const nested = obj.requestType
  if (nested && typeof nested === 'object') {
    const nestedName = nonEmptyString((nested as Record<string, unknown>).name)
    if (nestedName) return nestedName
  }

  const name = nonEmptyString(obj.name)
  if (name) return name

  const value = nonEmptyString(obj.value)
  if (value) return stripProjectPrefix(value)

  return ''
}

function linkedIssueKey(issue: unknown): string {
  if (!issue || typeof issue !== 'object') return ''
  return String((issue as Record<string, unknown>).key ?? '').trim()
}

export function extractLinkedIssueKeys(issuelinks: unknown): string[] {
  if (!Array.isArray(issuelinks)) return []

  const keys: string[] = []
  for (const link of issuelinks) {
    if (!link || typeof link !== 'object') continue
    const item = link as Record<string, unknown>
    const inward = linkedIssueKey(item.inwardIssue)
    const outward = linkedIssueKey(item.outwardIssue)
    if (inward) keys.push(inward)
    if (outward) keys.push(outward)
  }

  return [...new Set(keys)]
}

export function extractLinkedWorkItemKey(issuelinks: unknown): string {
  const keys = extractLinkedIssueKeys(issuelinks)
  return keys.find((key) => key.startsWith('CDPM-')) ?? keys.find((key) => !key.startsWith('CDT-')) ?? ''
}

export function extractLinkedCdtKeys(issuelinks: unknown): string[] {
  return extractLinkedIssueKeys(issuelinks).filter((key) => key.startsWith('CDT-'))
}

function parseSprintEntry(raw: unknown): { name: string; state: string } | null {
  if (typeof raw === 'string') {
    const name = raw.match(/name=([^,\]]+)/)?.[1]?.trim()
    if (!name) return null
    const state = raw.match(/state=([^,\]]+)/)?.[1]?.trim().toLowerCase() ?? ''
    return { name, state }
  }
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const name = typeof obj.name === 'string' ? obj.name.trim() : ''
  if (!name) return null
  const state = typeof obj.state === 'string' ? obj.state.trim().toLowerCase() : ''
  return { name, state }
}

export function extractSprintName(raw: unknown): string {
  const items = Array.isArray(raw) ? raw : raw != null ? [raw] : []
  const sprints = items
    .map(parseSprintEntry)
    .filter((sprint): sprint is { name: string; state: string } => sprint != null)
  const active = sprints.find((sprint) => sprint.state === 'active')
  return active?.name ?? sprints.at(-1)?.name ?? ''
}

export function extractOptionValue(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw.trim()
  if (typeof raw !== 'object') return ''
  const obj = raw as Record<string, unknown>
  if (typeof obj.value === 'string' && obj.value.trim()) return obj.value.trim()
  if (typeof obj.name === 'string' && obj.name.trim()) return obj.name.trim()
  if (typeof obj.displayName === 'string' && obj.displayName.trim()) return obj.displayName.trim()
  return ''
}

export function extractLabels(raw: unknown): string {
  if (!Array.isArray(raw)) return ''
  return raw.filter((label): label is string => typeof label === 'string' && label.trim().length > 0).join(', ')
}

export function extractStatusName(raw: unknown): string {
  return extractOptionValue(raw)
}

export function normalizeCdtTicket(raw: unknown): CdtTicket {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid ticket data')
  const r = raw as Record<string, unknown>
  const fields = (r.fields ?? {}) as Record<string, unknown>
  const reporter = fields.reporter as Record<string, unknown> | null | undefined
  const assignee = fields.assignee as Record<string, unknown> | null | undefined
  const requestTypeRaw = fields[CDT_TICKETS_CONFIG.requestTypeField]

  return {
    id: String(r.id ?? ''),
    key: String(r.key ?? ''),
    linkedKey: extractLinkedWorkItemKey(fields.issuelinks),
    summary: String(fields.summary ?? ''),
    requestType: extractRequestTypeName(requestTypeRaw),
    reporterName: reporter ? String(reporter.displayName ?? '') : '',
    created: typeof fields.created === 'string' ? fields.created : '',
    statusName: extractStatusName(fields.status),
    assigneeName: assignee ? String(assignee.displayName ?? '') : '',
  }
}

export function normalizeCdtTicketDetails(raw: unknown): CdtTicketDetails {
  const ticket = normalizeCdtTicket(raw)
  const r = raw as Record<string, unknown>
  const fields = (r.fields ?? {}) as Record<string, unknown>
  const cfg = CDT_TICKETS_CONFIG

  return {
    ...ticket,
    area: extractOptionValue(fields[cfg.areaField]),
    departamento: extractOptionValue(fields[cfg.departamentoField]),
    categoriaCanalDigital: extractOptionValue(fields[cfg.categoriaCanalDigitalField]),
    prioridad: extractOptionValue(fields[cfg.prioridadField]),
    un: extractOptionValue(fields[cfg.unField]),
    labels: extractLabels(fields.labels),
    priority: extractOptionValue(fields.priority),
    bl: extractOptionValue(fields[cfg.blField]),
    linkedStatus: '',
    description: adfToMarkdown(fields.description, { issueKey: ticket.key }),
  }
}

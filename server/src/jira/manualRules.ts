import { getEnv } from '../env'
import { getJiraClient } from './jiraClient'
import { mapJiraError, type JiraApiError } from './jiraErrors'

const AUTOMATION_HOST = 'https://api.atlassian.com/automation/public/jira'
const INPUT_TYPES = ['NUMBER', 'BOOLEAN', 'TEXT', 'DROPDOWN', 'PARAGRAPH'] as const

export type ManualRuleInputType = (typeof INPUT_TYPES)[number]

export interface ManualRuleInput {
  variableName: string
  displayName: string
  inputType: ManualRuleInputType
  required: boolean
  options: string[]
  defaultValue: string | number | boolean | null
}

export interface ManualRule {
  id: string
  name: string
  inputs: ManualRuleInput[]
}

export interface ManualRuleUserInput {
  inputType: ManualRuleInputType
  value: string | number | boolean
}

type RequestResult<T> = { ok: true; data: T } | { ok: false; error: JiraApiError }

let cachedCloudId: string | null = null

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function buildIssueAri(cloudId: string, issueId: string): string {
  return `ari:cloud:jira:${cloudId}:issue/${issueId}`
}

export function cursorFromLink(link: unknown): string | null {
  if (typeof link !== 'string' || !link.includes('cursor=')) return null
  const query = link.includes('?') ? link.slice(link.indexOf('?') + 1) : link
  return new URLSearchParams(query).get('cursor')
}

function readInput(raw: unknown): ManualRuleInput | null {
  const record = asRecord(raw)
  if (!record) return null
  const inputType = record.inputType
  if (typeof inputType !== 'string' || !INPUT_TYPES.includes(inputType as ManualRuleInputType)) {
    return null
  }
  const variableName = asNonEmptyString(record.variableName)
  const displayName = asNonEmptyString(record.displayName)
  if (!variableName || !displayName) return null

  let options: string[] = []
  let defaultValue: string | number | boolean | null = null
  if (inputType === 'DROPDOWN' && Array.isArray(record.defaultValue)) {
    options = record.defaultValue.filter((item): item is string => typeof item === 'string')
  } else if (
    typeof record.defaultValue === 'string' ||
    typeof record.defaultValue === 'number' ||
    typeof record.defaultValue === 'boolean'
  ) {
    defaultValue = record.defaultValue
  }

  return {
    variableName,
    displayName,
    inputType: inputType as ManualRuleInputType,
    required: record.required === true,
    options,
    defaultValue,
  }
}

export function normalizeManualRules(payload: unknown): ManualRule[] {
  const data = asRecord(payload)?.data
  if (!Array.isArray(data)) return []

  const rules: ManualRule[] = []
  for (const item of data) {
    const record = asRecord(item)
    if (!record) continue
    const id =
      asNonEmptyString(record.idUuid) ??
      (record.id == null ? null : String(record.id).trim())
    const name = asNonEmptyString(record.name)
    if (!id || !name) continue
    const inputs = Array.isArray(record.userInputs)
      ? record.userInputs.map(readInput).filter((input): input is ManualRuleInput => input !== null)
      : []
    rules.push({ id, name, inputs })
  }
  return rules
}

function automationError(status: number, body: unknown): JiraApiError {
  const titles: string[] = []
  const errors = asRecord(body)?.errors
  if (Array.isArray(errors)) {
    for (const item of errors) {
      const title = asNonEmptyString(asRecord(item)?.title)
      if (title) titles.push(title)
    }
  }
  return mapJiraError(status, titles.length > 0 ? { errorMessages: titles } : body)
}

function authHeader(): string {
  const env = getEnv()
  return `Basic ${Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString('base64')}`
}

async function automationPost(cloudId: string, path: string, body: unknown): Promise<RequestResult<unknown>> {
  try {
    const response = await fetch(`${AUTOMATION_HOST}/${encodeURIComponent(cloudId)}${path}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    const data = text ? (JSON.parse(text) as unknown) : null
    if (!response.ok) return { ok: false, error: automationError(response.status, data) }
    return { ok: true, data }
  } catch {
    return {
      ok: false,
      error: {
        statusCode: 503,
        message: 'No se pudo conectar con los automatismos de Jira.',
      },
    }
  }
}

async function resolveCloudId(): Promise<RequestResult<string>> {
  if (cachedCloudId) return { ok: true, data: cachedCloudId }
  const result = await getJiraClient().get<unknown>('/_edge/tenant_info')
  if (!result.ok) return result
  const cloudId = asNonEmptyString(asRecord(result.data)?.cloudId)
  if (!cloudId) {
    return {
      ok: false,
      error: {
        statusCode: 502,
        message: 'Jira no devolvió el identificador del sitio necesario para los automatismos.',
      },
    }
  }
  cachedCloudId = cloudId
  return { ok: true, data: cloudId }
}

export async function listManualRules(issueId: string): Promise<RequestResult<ManualRule[]>> {
  const cloud = await resolveCloudId()
  if (!cloud.ok) return cloud

  const ari = buildIssueAri(cloud.data, issueId)
  const rules: ManualRule[] = []
  const seen = new Set<string>()
  let cursor: string | null = null

  for (let page = 0; page < 5; page += 1) {
    const body = cursor ? { cursor, limit: 50 } : { objects: [ari], limit: 50 }
    const result = await automationPost(cloud.data, '/rest/v1/rule/manual/search', body)
    if (!result.ok) return result

    for (const rule of normalizeManualRules(result.data)) {
      if (seen.has(rule.id)) continue
      seen.add(rule.id)
      rules.push(rule)
    }

    cursor = cursorFromLink(asRecord(asRecord(result.data)?.links)?.next)
    if (!cursor) break
  }

  return { ok: true, data: rules }
}

const INVOCATION_MESSAGES: Record<string, string> = {
  INVALID_TARGET_OBJECT: 'Este automatismo no aplica a este ticket.',
  INVALID_RULE_OR_OBJECT: 'El automatismo no se puede ejecutar sobre este ticket.',
  INVALID_LICENSE: 'Se ha alcanzado el límite de ejecuciones de automatismos en Jira.',
  INVALID_TARGET_SCOPE: 'El ticket no está en el alcance de este automatismo.',
}

export async function invokeManualRule(
  issueId: string,
  ruleId: string,
  userInputs?: Record<string, ManualRuleUserInput>,
): Promise<RequestResult<'SUCCESS'>> {
  const cloud = await resolveCloudId()
  if (!cloud.ok) return cloud

  const ari = buildIssueAri(cloud.data, issueId)
  const body: Record<string, unknown> = { objects: [ari] }
  if (userInputs && Object.keys(userInputs).length > 0) body.userInputs = userInputs

  const result = await automationPost(
    cloud.data,
    `/rest/v1/rule/manual/${encodeURIComponent(ruleId)}/invocation`,
    body,
  )
  if (!result.ok) return result

  const status = asNonEmptyString(asRecord(result.data)?.[ari])
  if (status === 'SUCCESS') return { ok: true, data: 'SUCCESS' }

  return {
    ok: false,
    error: {
      statusCode: 400,
      message: (status && INVOCATION_MESSAGES[status]) || 'Jira no ha lanzado el automatismo.',
    },
  }
}

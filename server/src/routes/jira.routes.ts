import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getEnv } from '../env'
import { getJiraClient } from '../jira/jiraClient'
import { normalizeIssue, normalizeIssueWithWorklogs, normalizeWorklog } from '../jira/jiraNormalizer'
import { CDT_TICKETS_CONFIG, CDT_TICKET_DETAIL_FIELDS } from '../jira/cdtTicketsConfig'
import {
  normalizeCdtTicket,
  normalizeCdtTicketDetails,
  extractStatusName,
  extractLinkedCdtKeys,
  extractSprintName,
  type CdtTicket,
} from '../jira/normalizeCdtTicket'
import { sendJiraError } from '../jira/jiraErrors'
import {
  searchIssuesSchema,
  createWorklogSchema,
  updateWorklogSchema,
  updateTimetrackingSchema,
  transitionIssueSchema,
  updateIssueComponentsSchema,
  createStorySchema,
  updateStorySchema,
  listStoryParentsSchema,
  invokeManualRuleSchema,
} from '../schemas/jira.schemas'
import { invokeManualRule, listManualRules } from '../jira/manualRules'
import { sprintActionRequired, type ReadyForTestSubtask, type SprintActionRequired } from '../jira/readyForTest'
import { sprintAddedAt, type SprintChangelogEntry } from '../jira/sprintAddedAt'
import { ALLOWED_ISSUE_TYPE_IDS, ALLOWED_PILARES_OPTION_IDS, STORY_CREATE_CONFIG } from '../jira/storyCreateConfig'
import { parseJiraIssueKey } from '../jira/parseIssueKey'
import { buildFieldBackupCommentMarkdown } from '../jira/buildFieldBackupComment'
import { fetchIssueMediaBinary } from '../jira/resolveIssueMedia'
import { adfToMarkdown, buildAdfComment, markdownToAdf } from '../utils/adf'
import { getBitbucketClient } from '../bitbucket/bitbucketClient'

const ADJUST_ESTIMATE_VALUES = new Set(['auto', 'leave', 'new', 'manual'])

const ISSUE_FIELDS = [
  'summary',
  'status',
  'issuetype',
  'parent',
  'subtasks',
  'timetracking',
  'assignee',
  'worklog',
  'updated',
  'created',
  'components',
  'labels',
  CDT_TICKETS_CONFIG.sprintField,
].join(',')

interface OpenPullRequest {
  id: string
  title: string
  url: string | null
  state: string | null
  sourceBranch: string | null
  targetBranch: string | null
  repository: string | null
  author: string | null
}

interface JiraTransitionResponse {
  transitions?: Array<Record<string, unknown>>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function nestedName(value: unknown): string | null {
  const direct = asNonEmptyString(value)
  if (direct) return direct
  const record = asRecord(value)
  return record ? asNonEmptyString(record.name) ?? asNonEmptyString(record.full_name) : null
}

function decodeRepoPath(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function repositoryNameFromUrl(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/(?:bitbucket\.org|github\.com|gitlab\.com)\/([^/]+\/[^/]+)/i)
  return match ? decodeRepoPath(match[1]) : null
}

function isMachineRepositoryName(name: string): boolean {
  return /\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}/i.test(name)
}

function humanRepositoryName(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (value && !isMachineRepositoryName(value)) return value
  }
  return null
}

function repositorySlugFromNode(node: Record<string, unknown> | null): string | null {
  if (!node) return null
  return humanRepositoryName(repositoryNameFromUrl(asNonEmptyString(node.url)), nestedName(node))
}

function pullRequestDedupKey(pr: OpenPullRequest): string {
  return `${pr.id}::${pr.url ?? ''}::${pr.repository ?? ''}`
}

function parseOpenPullRequests(payload: unknown, openOnly = true): OpenPullRequest[] {
  if (!payload || typeof payload !== 'object') return []

  const data = payload as Record<string, unknown>
  const detail = Array.isArray(data.detail) ? (data.detail as Array<Record<string, unknown>>) : []
  const openPullRequests: OpenPullRequest[] = []

  for (const item of detail) {
    const pullRequests = Array.isArray(item.pullRequests)
      ? (item.pullRequests as Array<Record<string, unknown>>)
      : []

    for (const pr of pullRequests) {
      const statusRaw = pr.status
      const status =
        typeof statusRaw === 'string' && statusRaw.trim().length > 0 ? statusRaw.toUpperCase() : null
      if (openOnly && status && status !== 'OPEN') continue

      const author = asRecord(pr.author)
      const destination = asRecord(pr.destination)
      const source = asRecord(pr.source)
      const destinationRepo = asRecord(destination?.repository)
      const sourceRepo = asRecord(source?.repository)
      const url = asNonEmptyString(pr.url)

      const idValue = pr.id ?? pr.url ?? pr.name ?? pr.title
      const id = String(idValue ?? '').trim()
      if (!id) continue

      openPullRequests.push({
        id,
        title: String(pr.name ?? pr.title ?? id),
        url,
        state: status,
        sourceBranch: nestedName(source?.branch),
        targetBranch: nestedName(destination?.branch),
        repository:
          humanRepositoryName(
            repositorySlugFromNode(destinationRepo),
            repositorySlugFromNode(sourceRepo),
            repositoryNameFromUrl(asNonEmptyString(destination?.url)),
            repositoryNameFromUrl(asNonEmptyString(source?.url)),
            repositoryNameFromUrl(url),
            nestedName(destination?.name),
            nestedName(source?.name),
          ) ??
          nestedName(destinationRepo) ??
          nestedName(sourceRepo) ??
          repositoryNameFromUrl(url),
        author: nestedName(author),
      })
    }
  }

  const deduped = new Map<string, OpenPullRequest>()
  for (const pr of openPullRequests) {
    deduped.set(pullRequestDedupKey(pr), pr)
  }

  return Array.from(deduped.values())
}

const bitbucketRepoSlugCache = new Map<string, string>()

async function resolveMachineRepositoryNames(pullRequests: OpenPullRequest[]): Promise<void> {
  const machineNames = [
    ...new Set(
      pullRequests
        .map((pr) => pr.repository)
        .filter((name): name is string => Boolean(name && isMachineRepositoryName(name))),
    ),
  ]
  if (machineNames.length === 0) return

  await Promise.all(
    machineNames.map(async (name) => {
      if (bitbucketRepoSlugCache.has(name)) return
      const parts = name.match(
        /\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}/gi,
      )
      if (!parts || parts.length < 2) return
      const result = await getBitbucketClient().get<{ full_name?: string }>(
        `/repositories/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`,
      )
      const slug = result.ok ? result.data.full_name?.trim() : ''
      if (slug) bitbucketRepoSlugCache.set(name, slug)
    }),
  )

  for (const pullRequest of pullRequests) {
    if (!pullRequest.repository || !isMachineRepositoryName(pullRequest.repository)) continue
    const slug = bitbucketRepoSlugCache.get(pullRequest.repository)
    if (slug) pullRequest.repository = slug
  }
}

async function fetchPullRequestsForIssueId(
  jira: ReturnType<typeof getJiraClient>,
  issueId: string,
  openOnly = true,
): Promise<OpenPullRequest[]> {
  const applicationTypes = ['bitbucket', 'github', 'gitlab', 'stash']
  const results = await Promise.all(
    applicationTypes.map((applicationType) =>
      jira.get<Record<string, unknown>>(
        `/rest/dev-status/latest/issue/detail?issueId=${encodeURIComponent(issueId)}&applicationType=${encodeURIComponent(applicationType)}&dataType=pullrequest`,
      ),
    ),
  )

  const allPullRequests: OpenPullRequest[] = []
  for (const result of results) {
    if (!result.ok) continue
    allPullRequests.push(...parseOpenPullRequests(result.data, openOnly))
  }

  await resolveMachineRepositoryNames(allPullRequests)

  const deduped = new Map<string, OpenPullRequest>()
  for (const pr of allPullRequests) deduped.set(pullRequestDedupKey(pr), pr)
  return Array.from(deduped.values())
}

function summaryCount(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  const overall = (value as { overall?: { count?: unknown } }).overall
  const count = Number(overall?.count ?? 0)
  return Number.isFinite(count) && count > 0 ? count : 0
}

async function fetchDevStatusSummary(
  jira: ReturnType<typeof getJiraClient>,
  issueId: string,
): Promise<{ branchCount: number; commitCount: number }> {
  const result = await jira.get<Record<string, unknown>>(
    `/rest/dev-status/latest/issue/summary?issueId=${encodeURIComponent(issueId)}`,
  )
  if (!result.ok) return { branchCount: 0, commitCount: 0 }
  const summary = (result.data.summary ?? null) as Record<string, unknown> | null
  return {
    branchCount: summaryCount(summary?.branch),
    commitCount: summaryCount(summary?.repository),
  }
}

interface ParentStatusFields {
  summary: string | null
  statusName: string | null
  statusCategoryKey: string | null
  statusColorName: string | null
  issueType: string | null
}

async function fetchParentStatusByKeys(
  jira: ReturnType<typeof getJiraClient>,
  parentKeys: string[],
): Promise<Map<string, ParentStatusFields>> {
  const uniqueKeys = [...new Set(parentKeys.map((key) => key.trim().toUpperCase()).filter(Boolean))]
  const parents = new Map<string, ParentStatusFields>()
  if (uniqueKeys.length === 0) return parents

  for (let index = 0; index < uniqueKeys.length; index += 50) {
    const chunk = uniqueKeys.slice(index, index + 50)
    const result = await jira.post<{
      issues?: Array<{
        key?: string
        fields?: {
          summary?: string
          status?: {
            name?: string
            statusCategory?: { key?: string; colorName?: string }
          }
          issuetype?: { name?: string }
        }
      }>
    }>('/rest/api/3/search/jql', {
      jql: `key in (${chunk.join(',')})`,
      maxResults: chunk.length,
      fields: ['summary', 'status', 'issuetype'],
    })
    if (!result.ok) continue

    for (const issue of result.data.issues ?? []) {
      const key = String(issue.key ?? '').toUpperCase()
      if (!key) continue
      const status = issue.fields?.status
      const category = status?.statusCategory
      parents.set(key, {
        summary: issue.fields?.summary?.trim() || null,
        statusName: status?.name?.trim() || null,
        statusCategoryKey: category?.key?.trim() || null,
        statusColorName: category?.colorName?.trim() || null,
        issueType: issue.fields?.issuetype?.name?.trim() || null,
      })
    }
  }

  return parents
}

function changelogCreated(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString()
  if (typeof value === 'string' && value.trim()) return value
  return null
}

async function fetchSprintChangelogs(
  jira: ReturnType<typeof getJiraClient>,
  issueIds: string[],
): Promise<Map<string, SprintChangelogEntry[]>> {
  const historiesByIssueId = new Map<string, SprintChangelogEntry[]>()
  const ids = [...new Set(issueIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return historiesByIssueId

  let nextPageToken: string | undefined
  while (true) {
    const body: Record<string, unknown> = {
      issueIdsOrKeys: ids,
      fieldIds: [CDT_TICKETS_CONFIG.sprintField],
      maxResults: 1000,
    }
    if (nextPageToken) body.nextPageToken = nextPageToken
    const result = await jira.post<{
      issueChangeLogs?: Array<{
        issueId?: string
        changeHistories?: Array<{ created?: unknown; items?: SprintChangelogEntry['items'] }>
      }>
      nextPageToken?: string | null
    }>('/rest/api/3/changelog/bulkfetch', body)
    if (!result.ok) return historiesByIssueId

    for (const entry of result.data.issueChangeLogs ?? []) {
      const issueId = String(entry.issueId ?? '')
      if (!issueId) continue
      const list = historiesByIssueId.get(issueId) ?? []
      for (const history of entry.changeHistories ?? []) {
        const created = changelogCreated(history.created)
        if (!created) continue
        list.push({ created, items: history.items ?? [] })
      }
      historiesByIssueId.set(issueId, list)
    }

    nextPageToken = result.data.nextPageToken ?? undefined
    if (!nextPageToken) break
  }

  return historiesByIssueId
}

function subtasksFromIssue(raw: unknown): ReadyForTestSubtask[] {
  if (!raw || typeof raw !== 'object') return []
  const fields = (raw as { fields?: { subtasks?: unknown } }).fields
  if (!Array.isArray(fields?.subtasks)) return []
  return fields.subtasks.flatMap((subtask) => {
    if (!subtask || typeof subtask !== 'object') return []
    const subtaskFields = (subtask as { fields?: { summary?: unknown; status?: { name?: unknown } } }).fields
    const summary = typeof subtaskFields?.summary === 'string' ? subtaskFields.summary : ''
    const statusName = typeof subtaskFields?.status?.name === 'string' ? subtaskFields.status.name : ''
    if (!summary && !statusName) return []
    return [{ summary, statusName }]
  })
}

export async function jiraRoutes(fastify: FastifyInstance): Promise<void> {
  const jira = getJiraClient()
  const env = getEnv()

  // GET /api/jira/connection-info
  fastify.get('/connection-info', async (_req, reply) => {
    return reply.send({
      jiraBaseUrl: env.JIRA_BASE_URL,
    })
  })

  // GET /api/jira/me
  fastify.get('/me', async (_req, reply) => {
    const result = await jira.get<Record<string, unknown>>('/rest/api/3/myself')
    if (!result.ok) return sendJiraError(reply, result.error)
    const { data } = result
    return reply.send({
      accountId: data.accountId,
      displayName: data.displayName,
      emailAddress: data.emailAddress,
      active: data.active,
    })
  })

  // GET /api/jira/tickets — open CDT service-desk tickets
  fastify.get('/tickets', async (_req, reply) => {
    const tickets: CdtTicket[] = []
    let nextPageToken: string | undefined

    while (tickets.length < CDT_TICKETS_CONFIG.maxTickets) {
      const body: Record<string, unknown> = {
        jql: CDT_TICKETS_CONFIG.jql,
        maxResults: Math.min(
          CDT_TICKETS_CONFIG.pageSize,
          CDT_TICKETS_CONFIG.maxTickets - tickets.length,
        ),
        fields: ['summary', 'reporter', 'assignee', 'issuelinks', 'created', 'status', 'labels', CDT_TICKETS_CONFIG.requestTypeField],
      }
      if (nextPageToken) body.nextPageToken = nextPageToken

      const result = await jira.post<{
        issues?: unknown[]
        nextPageToken?: string | null
      }>('/rest/api/3/search/jql', body)
      if (!result.ok) return sendJiraError(reply, result.error)

      const page = result.data.issues ?? []
      tickets.push(...page.map(normalizeCdtTicket))

      const token = result.data.nextPageToken
      if (!token || page.length === 0) break
      nextPageToken = token
    }

    return reply.send({ tickets, total: tickets.length })
  })

  // GET /api/jira/tickets/:issueKey — CDT ticket detail for the popup
  fastify.get(
    '/tickets/:issueKey',
    async (req: FastifyRequest<{ Params: { issueKey: string } }>, reply) => {
      const parsedKey = parseJiraIssueKey(req.params.issueKey)
      if (!parsedKey) return reply.status(400).send({ error: 'Invalid issue key or URL' })

      const result = await jira.get<unknown>(
        `/rest/api/3/issue/${encodeURIComponent(parsedKey)}?fields=${CDT_TICKET_DETAIL_FIELDS.join(',')}`,
      )
      if (!result.ok) return sendJiraError(reply, result.error)

      const details = normalizeCdtTicketDetails(result.data)
      if (details.linkedKey) {
        const linked = await jira.get<{ fields?: { status?: unknown } }>(
          `/rest/api/3/issue/${encodeURIComponent(details.linkedKey)}?fields=status`,
        )
        if (linked.ok) details.linkedStatus = extractStatusName(linked.data.fields?.status)
      }

      return reply.send(details)
    },
  )

  // GET /api/jira/manual-rules/:issueId — manual automations available on a ticket
  fastify.get(
    '/manual-rules/:issueId',
    async (req: FastifyRequest<{ Params: { issueId: string } }>, reply) => {
      if (!/^\d+$/.test(req.params.issueId)) {
        return reply.status(400).send({ error: 'Invalid issue id' })
      }
      const result = await listManualRules(req.params.issueId)
      if (!result.ok) return sendJiraError(reply, result.error)
      return reply.send({ rules: result.data })
    },
  )

  // POST /api/jira/manual-rules/:issueId/:ruleId — invoke a manual automation on a ticket
  fastify.post(
    '/manual-rules/:issueId/:ruleId',
    async (
      req: FastifyRequest<{ Params: { issueId: string; ruleId: string }; Body: unknown }>,
      reply,
    ) => {
      if (!/^\d+$/.test(req.params.issueId)) {
        return reply.status(400).send({ error: 'Invalid issue id' })
      }
      if (!/^[\w.-]+$/.test(req.params.ruleId)) {
        return reply.status(400).send({ error: 'Invalid rule id' })
      }
      const parsed = invokeManualRuleSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
      }

      const result = await invokeManualRule(
        req.params.issueId,
        req.params.ruleId,
        parsed.data.userInputs,
      )
      if (!result.ok) return sendJiraError(reply, result.error)
      return reply.send({ status: result.data })
    },
  )

  // GET /api/jira/ticket-stories/:issueKey — CDPM story linked from a CDT ticket
  fastify.get(
    '/ticket-stories/:issueKey',
    async (req: FastifyRequest<{ Params: { issueKey: string } }>, reply) => {
      const parsedKey = parseJiraIssueKey(req.params.issueKey)
      if (!parsedKey) return reply.status(400).send({ error: 'Invalid issue key or URL' })

      const fields = [
        'summary',
        'status',
        'issuelinks',
        CDT_TICKETS_CONFIG.sprintField,
      ].join(',')
      const issueResult = await jira.get<Record<string, unknown>>(
        `/rest/api/3/issue/${encodeURIComponent(parsedKey)}?fields=${fields}`,
      )
      if (!issueResult.ok) return sendJiraError(reply, issueResult.error)

      const issue = issueResult.data
      const issueFields = (issue.fields ?? {}) as Record<string, unknown>
      const issueId = String(issue.id ?? '').trim()
      const subtaskJql = `parent = ${parsedKey} ORDER BY key ASC`

      const [pullRequests, subtasksResult] = await Promise.all([
        issueId ? fetchPullRequestsForIssueId(jira, issueId, false) : Promise.resolve([]),
        jira.post<{ issues?: unknown[] }>('/rest/api/3/search/jql', {
          jql: subtaskJql,
          maxResults: 100,
          fields: ['summary', 'assignee', 'status', 'timetracking'],
        }),
      ])

      if (!subtasksResult.ok) return sendJiraError(reply, subtasksResult.error)

      const subtasks = (subtasksResult.data.issues ?? []).map((raw) => {
        const normalized = normalizeIssue(raw)
        return {
          key: normalized.key,
          summary: normalized.summary,
          assigneeName: normalized.assigneeName ?? '',
          statusName: normalized.statusName,
          timeSpent: normalized.timetracking.timeSpent ?? '',
          originalEstimate: normalized.timetracking.originalEstimate ?? '',
        }
      })

      return reply.send({
        key: String(issue.key ?? parsedKey),
        summary: String(issueFields.summary ?? ''),
        statusName: extractStatusName(issueFields.status),
        ticketKeys: extractLinkedCdtKeys(issueFields.issuelinks),
        sprintName: extractSprintName(issueFields[CDT_TICKETS_CONFIG.sprintField]),
        pullRequests,
        subtasks,
      })
    },
  )

  // POST /api/jira/issues/search
  fastify.post('/issues/search', async (req: FastifyRequest, reply) => {
    const parsed = searchIssuesSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
    }
    const { jql, maxResults, nextPageToken, includeWorklogs } = parsed.data

    const fields = [
      'summary',
      'status',
      'issuetype',
      'parent',
      'subtasks',
      'timetracking',
      'assignee',
      'updated',
      'created',
      'components',
      'labels',
      CDT_TICKETS_CONFIG.sprintField,
    ]
    if (includeWorklogs) fields.push('worklog')

    const body: Record<string, unknown> = {
      jql,
      maxResults,
      fields,
    }
    if (nextPageToken) body.nextPageToken = nextPageToken

    const result = await jira.post<Record<string, unknown>>('/rest/api/3/search/jql', body)
    if (!result.ok) return sendJiraError(reply, result.error)

    const issues = (result.data.issues ?? []) as unknown[]

    return reply.send({
      issues: includeWorklogs
        ? issues.map(normalizeIssueWithWorklogs)
        : issues.map(normalizeIssue),
      total: result.data.total ?? issues.length,
      nextPageToken: result.data.nextPageToken ?? null,
    })
  })

  // GET /api/jira/issues/:issueKey
  fastify.get(
    '/issues/:issueKey',
    async (req: FastifyRequest<{ Params: { issueKey: string } }>, reply) => {
      const { issueKey } = req.params
      const result = await jira.get<unknown>(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=${ISSUE_FIELDS}`,
      )
      if (!result.ok) return sendJiraError(reply, result.error)
      return reply.send(normalizeIssue(result.data))
    },
  )

  // GET /api/jira/issues/:issueKey/open-pull-requests
  fastify.get(
    '/issues/:issueKey/open-pull-requests',
    async (req: FastifyRequest<{ Params: { issueKey: string } }>, reply) => {
      const { issueKey } = req.params
      const issueResult = await jira.get<Record<string, unknown>>(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary`,
      )
      if (!issueResult.ok) return sendJiraError(reply, issueResult.error)

      const issueId = String(issueResult.data.id ?? '').trim()
      if (!issueId) return reply.send({ pullRequests: [] })

      return reply.send({ pullRequests: await fetchPullRequestsForIssueId(jira, issueId) })
    },
  )

  // GET /api/jira/issues/:issueKey/development — pull requests, branches and commits
  fastify.get(
    '/issues/:issueKey/development',
    async (req: FastifyRequest<{ Params: { issueKey: string } }>, reply) => {
      const { issueKey } = req.params
      const issueResult = await jira.get<Record<string, unknown>>(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary`,
      )
      if (!issueResult.ok) return sendJiraError(reply, issueResult.error)

      const issueId = String(issueResult.data.id ?? '').trim()
      if (!issueId) return reply.send({ pullRequests: [], branchCount: 0, commitCount: 0 })

      const [pullRequests, summary] = await Promise.all([
        fetchPullRequestsForIssueId(jira, issueId, false),
        fetchDevStatusSummary(jira, issueId),
      ])
      return reply.send({
        pullRequests,
        branchCount: summary.branchCount,
        commitCount: summary.commitCount,
      })
    },
  )

  // GET /api/jira/stories/pending-production — CDPM stories in "Listo Producción"
  fastify.get('/stories/pending-production', async (_req, reply) => {
    const jql = `project = ${STORY_CREATE_CONFIG.projectKey} AND issuetype = Historia AND status = "Listo Producción" ORDER BY updated DESC`
    const issues: ReturnType<typeof normalizeIssue>[] = []
    let nextPageToken: string | undefined

    while (issues.length < 100) {
      const body: Record<string, unknown> = {
        jql,
        maxResults: Math.min(50, 100 - issues.length),
        fields: ['summary', 'status', 'parent'],
      }
      if (nextPageToken) body.nextPageToken = nextPageToken

      const result = await jira.post<{ issues?: unknown[]; nextPageToken?: string | null }>(
        '/rest/api/3/search/jql',
        body,
      )
      if (!result.ok) return sendJiraError(reply, result.error)

      const page = (result.data.issues ?? []).map(normalizeIssue)
      issues.push(...page)
      nextPageToken = result.data.nextPageToken ?? undefined
      if (!nextPageToken || page.length === 0) break
    }

    const parentStatuses = await fetchParentStatusByKeys(
      jira,
      issues
        .filter((issue) => issue.parentKey && (!issue.parentStatusColorName || !issue.parentStatusCategoryKey))
        .map((issue) => issue.parentKey as string),
    )
    for (const issue of issues) {
      if (!issue.parentKey) continue
      const parent = parentStatuses.get(issue.parentKey.toUpperCase())
      if (!parent) continue
      issue.parentSummary = issue.parentSummary ?? parent.summary
      issue.parentStatusName = parent.statusName ?? issue.parentStatusName
      issue.parentStatusCategoryKey = parent.statusCategoryKey ?? issue.parentStatusCategoryKey
      issue.parentStatusColorName = parent.statusColorName ?? issue.parentStatusColorName
      issue.parentIssueType = parent.issueType ?? issue.parentIssueType
    }

    return reply.send({
      stories: issues.map((issue) => ({
        key: issue.key,
        summary: issue.summary,
        statusName: issue.statusName,
        parentKey: issue.parentKey,
        parentSummary: issue.parentSummary,
        parentStatusName: issue.parentStatusName,
        parentStatusCategoryKey: issue.parentStatusCategoryKey,
        parentStatusColorName: issue.parentStatusColorName,
        parentIssueType: issue.parentIssueType,
      })),
    })
  })

  // GET /api/jira/stories/sprint — CDPM stories in the active sprint
  fastify.get('/stories/sprint', async (_req, reply) => {
    const jql = `project = ${STORY_CREATE_CONFIG.projectKey} AND sprint in openSprints() AND issuetype != Subtarea AND issuetype != "Sub-tarea" ORDER BY Rank ASC`
    const stories: Array<{
      key: string
      summary: string
      statusName: string
      assigneeName: string | null
      sprintName: string
      actionRequired: SprintActionRequired | null
      addedAt: string
      parentKey: string | null
      parentSummary: string | null
      parentStatusName: string | null
      parentStatusCategoryKey: string | null
      parentStatusColorName: string | null
      parentIssueType: string | null
    }> = []
    const issueIdByKey = new Map<string, string>()
    const subtasksByParent = new Map<string, ReadyForTestSubtask[]>()
    let nextPageToken: string | undefined

    while (stories.length < 100) {
      const body: Record<string, unknown> = {
        jql,
        maxResults: Math.min(50, 100 - stories.length),
        fields: ['summary', 'status', 'assignee', 'created', 'parent', 'subtasks', CDT_TICKETS_CONFIG.sprintField],
      }
      if (nextPageToken) body.nextPageToken = nextPageToken

      const result = await jira.post<{ issues?: unknown[]; nextPageToken?: string | null }>(
        '/rest/api/3/search/jql',
        body,
      )
      if (!result.ok) return sendJiraError(reply, result.error)

      for (const raw of result.data.issues ?? []) {
        const issue = normalizeIssue(raw)
        issueIdByKey.set(issue.key, issue.id)
        subtasksByParent.set(issue.key.toUpperCase(), subtasksFromIssue(raw))
        stories.push({
          key: issue.key,
          summary: issue.summary,
          statusName: issue.statusName,
          assigneeName: issue.assigneeName,
          sprintName: issue.sprintName,
          actionRequired: null,
          addedAt: issue.created,
          parentKey: issue.parentKey,
          parentSummary: issue.parentSummary,
          parentStatusName: issue.parentStatusName,
          parentStatusCategoryKey: issue.parentStatusCategoryKey,
          parentStatusColorName: issue.parentStatusColorName,
          parentIssueType: issue.parentIssueType,
        })
      }

      nextPageToken = result.data.nextPageToken ?? undefined
      if (!nextPageToken || (result.data.issues ?? []).length === 0) break
    }

    const parentStatuses = await fetchParentStatusByKeys(
      jira,
      stories.flatMap((story) =>
        story.parentKey && (!story.parentStatusColorName || !story.parentIssueType) ? [story.parentKey] : [],
      ),
    )
    for (const story of stories) {
      if (!story.parentKey) continue
      const parent = parentStatuses.get(story.parentKey.toUpperCase())
      if (!parent) continue
      story.parentSummary = story.parentSummary ?? parent.summary
      story.parentStatusName = parent.statusName ?? story.parentStatusName
      story.parentStatusCategoryKey = parent.statusCategoryKey ?? story.parentStatusCategoryKey
      story.parentStatusColorName = parent.statusColorName ?? story.parentStatusColorName
      story.parentIssueType = parent.issueType ?? story.parentIssueType
    }

    for (const story of stories) {
      const subtasks = subtasksByParent.get(story.key.toUpperCase()) ?? []
      story.actionRequired = sprintActionRequired(story.statusName, subtasks)
    }

    const changelogs = await fetchSprintChangelogs(jira, [...issueIdByKey.values()])
    for (const story of stories) {
      const issueId = issueIdByKey.get(story.key)
      const histories = issueId ? changelogs.get(issueId) ?? [] : []
      story.addedAt = sprintAddedAt(story.addedAt, histories)
    }

    const sprintNames = [...new Set(stories.map((story) => story.sprintName).filter(Boolean))]
    return reply.send({
      sprintName: sprintNames.length === 1 ? sprintNames[0] : null,
      stories,
    })
  })

  // GET /api/jira/issues/:issueKey/transitions
  fastify.get(
    '/issues/:issueKey/transitions',
    async (req: FastifyRequest<{ Params: { issueKey: string } }>, reply) => {
      const { issueKey } = req.params
      const result = await jira.get<JiraTransitionResponse>(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
      )
      if (!result.ok) return sendJiraError(reply, result.error)

      const transitions = (result.data.transitions ?? []).map((transition) => {
        const to = (transition.to ?? null) as Record<string, unknown> | null
        return {
          id: String(transition.id ?? ''),
          name: String(transition.name ?? ''),
          toStatusName: String(to?.name ?? ''),
        }
      }).filter((transition) => transition.id && transition.name)

      return reply.send({ transitions })
    },
  )

  // POST /api/jira/issues/:issueKey/transitions
  fastify.post(
    '/issues/:issueKey/transitions',
    async (
      req: FastifyRequest<{ Params: { issueKey: string }; Body: { transitionId?: string } }>,
      reply,
    ) => {
      const { issueKey } = req.params
      const parsed = transitionIssueSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
      }

      const result = await jira.post<unknown>(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
        { transition: { id: parsed.data.transitionId } },
      )
      if (!result.ok) return sendJiraError(reply, result.error)

      const issueResult = await jira.get<Record<string, unknown>>(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=status`,
      )
      if (!issueResult.ok) return sendJiraError(reply, issueResult.error)

      const fields = (issueResult.data.fields ?? null) as Record<string, unknown> | null
      const status = (fields?.status ?? null) as Record<string, unknown> | null

      return reply.send({
        success: true,
        statusName: String(status?.name ?? ''),
      })
    },
  )

  // GET /api/jira/issues/:issueKey/worklogs
  fastify.get(
    '/issues/:issueKey/worklogs',
    async (req: FastifyRequest<{ Params: { issueKey: string } }>, reply) => {
      const { issueKey } = req.params
      const result = await jira.get<Record<string, unknown>>(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog`,
      )
      if (!result.ok) return sendJiraError(reply, result.error)

      const worklogs = (result.data.worklogs ?? []) as unknown[]
      return reply.send({
        worklogs: worklogs.map((w) => normalizeWorklog(w, issueKey)),
        total: result.data.total ?? worklogs.length,
      })
    },
  )

  // POST /api/jira/issues/:issueKey/worklogs
  fastify.post(
    '/issues/:issueKey/worklogs',
    async (req: FastifyRequest<{ Params: { issueKey: string } }>, reply) => {
      const { issueKey } = req.params
      const parsed = createWorklogSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
      }
      const { timeSpent, started, comment, adjustEstimate, newEstimate, increaseBy } = parsed.data

      const payload: Record<string, unknown> = {
        timeSpent,
        started,
        comment: buildAdfComment(comment),
      }

      let url = `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog?notifyUsers=false`
      if (adjustEstimate === 'new' && newEstimate) {
        url += `&adjustEstimate=new&newEstimate=${encodeURIComponent(newEstimate)}`
      } else if (adjustEstimate === 'manual' && increaseBy) {
        url += `&adjustEstimate=manual&increaseBy=${encodeURIComponent(increaseBy)}`
      } else {
        url += `&adjustEstimate=${adjustEstimate}`
      }

      const result = await jira.post<unknown>(url, payload)
      if (!result.ok) return sendJiraError(reply, result.error)
      return reply.status(201).send(normalizeWorklog(result.data, issueKey))
    },
  )

  // PUT /api/jira/issues/:issueKey/worklogs/:worklogId
  fastify.put(
    '/issues/:issueKey/worklogs/:worklogId',
    async (
      req: FastifyRequest<{ Params: { issueKey: string; worklogId: string } }>,
      reply,
    ) => {
      const { issueKey, worklogId } = req.params
      const parsed = updateWorklogSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
      }
      const { timeSpent, started, comment, adjustEstimate, newEstimate, increaseBy } = parsed.data

      const payload: Record<string, unknown> = {
        timeSpent,
        started,
        comment: buildAdfComment(comment),
      }

      let url = `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}?notifyUsers=false`
      if (adjustEstimate === 'new' && newEstimate) {
        url += `&adjustEstimate=new&newEstimate=${encodeURIComponent(newEstimate)}`
      } else if (adjustEstimate === 'manual' && increaseBy) {
        url += `&adjustEstimate=manual&increaseBy=${encodeURIComponent(increaseBy)}`
      } else {
        url += `&adjustEstimate=${adjustEstimate}`
      }

      const result = await jira.put<unknown>(url, payload)
      if (!result.ok) return sendJiraError(reply, result.error)
      return reply.send(normalizeWorklog(result.data, issueKey))
    },
  )

  // DELETE /api/jira/issues/:issueKey/worklogs/:worklogId
  fastify.delete(
    '/issues/:issueKey/worklogs/:worklogId',
    async (
      req: FastifyRequest<{
        Params: { issueKey: string; worklogId: string }
        Querystring: { adjustEstimate?: string }
      }>,
      reply,
    ) => {
      const { issueKey, worklogId } = req.params
      const requestedAdjustEstimate =
        (req.query as Record<string, string | undefined>).adjustEstimate ?? 'auto'
      const adjustEstimate = ADJUST_ESTIMATE_VALUES.has(requestedAdjustEstimate)
        ? requestedAdjustEstimate
        : 'auto'

      const url = `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}?adjustEstimate=${adjustEstimate}&notifyUsers=false`
      const result = await jira.delete(url)
      if (!result.ok) return sendJiraError(reply, result.error)
      return reply.status(204).send()
    },
  )

  // PUT /api/jira/issues/:issueKey/timetracking
  fastify.put(
    '/issues/:issueKey/timetracking',
    async (req: FastifyRequest<{ Params: { issueKey: string } }>, reply) => {
      const { issueKey } = req.params
      const parsed = updateTimetrackingSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
      }
      const { originalEstimate, remainingEstimate } = parsed.data

      const timetracking: Record<string, string> = {}
      if (originalEstimate) timetracking.originalEstimate = originalEstimate
      if (remainingEstimate) timetracking.remainingEstimate = remainingEstimate

      const result = await jira.put<unknown>(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
        { fields: { timetracking } },
      )
      if (!result.ok) return sendJiraError(reply, result.error)
      return reply.send({ success: true })
    },
  )

  // PUT /api/jira/issues/:issueKey/components
  fastify.put(
    '/issues/:issueKey/components',
    async (
      req: FastifyRequest<{ Params: { issueKey: string }; Body: { componentIds?: string[] } }>,
      reply,
    ) => {
      const parsedKey = parseJiraIssueKey(req.params.issueKey)
      if (!parsedKey) return reply.status(400).send({ error: 'Invalid issue key or URL' })

      const parsed = updateIssueComponentsSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
      }

      const invalidComponent = parsed.data.componentIds.find(
        (id) => !STORY_CREATE_CONFIG.allowedComponentIds.has(id),
      )
      if (invalidComponent) {
        return reply.status(400).send({ error: `Invalid componentId: ${invalidComponent}` })
      }

      const result = await jira.put<unknown>(
        `/rest/api/3/issue/${encodeURIComponent(parsedKey)}`,
        { fields: { components: parsed.data.componentIds.map((id) => ({ id })) } },
      )
      if (!result.ok) return sendJiraError(reply, result.error)

      const issueResult = await jira.get<Record<string, unknown>>(
        `/rest/api/3/issue/${encodeURIComponent(parsedKey)}?fields=components`,
      )
      if (!issueResult.ok) {
        return reply.send({ success: true as const, components: [] as string[] })
      }

      const fields = (issueResult.data.fields ?? {}) as Record<string, unknown>
      const componentsRaw = Array.isArray(fields.components) ? fields.components : []
      const components = componentsRaw
        .map((component) => {
          if (!component || typeof component !== 'object') return ''
          return String((component as { name?: unknown }).name ?? '').trim()
        })
        .filter(Boolean)

      return reply.send({ success: true as const, components })
    },
  )

  // GET /api/jira/stories/create-options
  fastify.get('/stories/create-options', async (_req, reply) => {
    const [componentsResult, projectResult] = await Promise.all([
      jira.get<Array<{ id?: string; name?: string }>>(
        `/rest/api/3/project/${encodeURIComponent(STORY_CREATE_CONFIG.projectKey)}/components`,
      ),
      jira.get<{
        issueTypes?: Array<{ id?: string; name?: string; iconUrl?: string; subtask?: boolean }>
      }>(`/rest/api/3/project/${encodeURIComponent(STORY_CREATE_CONFIG.projectKey)}`),
    ])
    if (!componentsResult.ok) return sendJiraError(reply, componentsResult.error)
    if (!projectResult.ok) return sendJiraError(reply, projectResult.error)

    const components = (Array.isArray(componentsResult.data) ? componentsResult.data : [])
      .map((c) => ({
        id: String(c.id ?? ''),
        name: String(c.name ?? ''),
      }))
      .filter(
        (c) =>
          c.id.length > 0 &&
          c.name.length > 0 &&
          STORY_CREATE_CONFIG.allowedComponentIds.has(c.id),
      )
      .sort((a, b) => {
        const aWeb = a.name.toUpperCase() === 'WEB'
        const bWeb = b.name.toUpperCase() === 'WEB'
        if (aWeb && !bWeb) return -1
        if (!aWeb && bWeb) return 1
        return a.name.localeCompare(b.name)
      })

    const byId = new Map(
      (projectResult.data.issueTypes ?? [])
        .filter((t) => t && !t.subtask && t.id && ALLOWED_ISSUE_TYPE_IDS.has(String(t.id)))
        .map((t) => [
          String(t.id),
          {
            id: String(t.id),
            name: String(t.name ?? ''),
            iconUrl: typeof t.iconUrl === 'string' ? t.iconUrl : null,
          },
        ]),
    )

    const issueTypes = STORY_CREATE_CONFIG.allowedIssueTypes.map((configured) => {
      const fromJira = byId.get(configured.id)
      return {
        id: configured.id,
        name: fromJira?.name || configured.name,
        iconUrl: fromJira?.iconUrl ?? null,
      }
    })

    return reply.send({
      projectKey: STORY_CREATE_CONFIG.projectKey,
      projectName: STORY_CREATE_CONFIG.projectName,
      defaultIssueTypeId: STORY_CREATE_CONFIG.defaultIssueTypeId,
      epicIssueTypeId: STORY_CREATE_CONFIG.epicIssueTypeId,
      unOptionValue: STORY_CREATE_CONFIG.unOptionValue,
      issueTypes,
      components,
      pilares: STORY_CREATE_CONFIG.pilaresOptions.map((o) => ({
        id: o.id,
        value: o.value,
      })),
    })
  })

  // GET /api/jira/stories/parents — lazy-loaded Epica list for Parent selector
  fastify.get('/stories/parents', async (req: FastifyRequest, reply) => {
    const parsed = listStoryParentsSchema.safeParse(req.query ?? {})
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
    }

    const { includeDone, q } = parsed.data
    const clauses = [
      `project = ${STORY_CREATE_CONFIG.projectKey}`,
      `issuetype = ${STORY_CREATE_CONFIG.epicIssueTypeId}`,
    ]
    if (!includeDone) {
      clauses.push('statusCategory != Done')
    }

    const query = q.trim()
    if (query) {
      const escaped = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      if (/^[A-Z][A-Z0-9]+-\d+$/i.test(query)) {
        clauses.push(`key = ${query.toUpperCase()}`)
      } else {
        clauses.push(`summary ~ "${escaped}"`)
      }
    }

    const jql = `${clauses.join(' AND ')} ORDER BY updated DESC`
    const result = await jira.post<{
      issues?: Array<{
        id?: string
        key?: string
        fields?: {
          summary?: string
          status?: {
            name?: string
            statusCategory?: { key?: string; colorName?: string; name?: string }
          }
        }
      }>
    }>('/rest/api/3/search/jql', {
      jql,
      maxResults: 50,
      fields: ['summary', 'status'],
    })
    if (!result.ok) return sendJiraError(reply, result.error)

    const parents = (result.data.issues ?? [])
      .map((issue) => {
        const status = issue.fields?.status
        const category = status?.statusCategory
        return {
          id: String(issue.id ?? ''),
          key: String(issue.key ?? ''),
          summary: String(issue.fields?.summary ?? ''),
          statusName: String(status?.name ?? ''),
          statusCategoryKey: String(category?.key ?? ''),
          statusColorName: String(category?.colorName ?? ''),
        }
      })
      .filter((p) => p.id && p.key)

    return reply.send({ parents })
  })

  const STORY_EDIT_FIELDS = [
    'summary',
    'description',
    'issuetype',
    'components',
    'parent',
    'status',
    'project',
    STORY_CREATE_CONFIG.valorField,
    STORY_CREATE_CONFIG.pilaresField,
    STORY_CREATE_CONFIG.storyPointsField,
    STORY_CREATE_CONFIG.acceptanceCriteriaField,
    STORY_CREATE_CONFIG.epicLinkField,
  ].join(',')

  function buildStoryFields(data: {
    summary: string
    issueTypeId: string
    componentIds: string[]
    valor: string
    description: string
    parentKey: string | null
    pilarId: string | null
    storyPoints: number | null
    acceptanceCriteria: string | null
  }, options?: { includeProject?: boolean }): Record<string, unknown> {
    const fields: Record<string, unknown> = {
      issuetype: { id: data.issueTypeId },
      summary: data.summary,
      components: data.componentIds.map((id) => ({ id })),
      [STORY_CREATE_CONFIG.unField]: { id: STORY_CREATE_CONFIG.unOptionId },
      [STORY_CREATE_CONFIG.valorField]: buildAdfComment(data.valor),
      description: data.description.trim()
        ? markdownToAdf(data.description)
        : markdownToAdf(''),
      [STORY_CREATE_CONFIG.storyPointsField]: data.storyPoints,
      [STORY_CREATE_CONFIG.acceptanceCriteriaField]: data.acceptanceCriteria?.trim()
        ? markdownToAdf(data.acceptanceCriteria)
        : null,
      [STORY_CREATE_CONFIG.pilaresField]: data.pilarId ? { id: data.pilarId } : null,
    }

    if (options?.includeProject) {
      fields.project = { key: STORY_CREATE_CONFIG.projectKey }
    }

    if (data.parentKey) {
      fields.parent = { key: data.parentKey }
      fields[STORY_CREATE_CONFIG.epicLinkField] = data.parentKey
    } else {
      fields[STORY_CREATE_CONFIG.epicLinkField] = null
    }

    return fields
  }

  function validateStoryPayload(data: {
    issueTypeId: string
    componentIds: string[]
    pilarId: string | null
    parentKey: string | null
  }): string | null {
    if (!ALLOWED_ISSUE_TYPE_IDS.has(data.issueTypeId)) {
      return `Invalid issueTypeId: ${data.issueTypeId}`
    }
    const invalidComponent = data.componentIds.find(
      (id) => !STORY_CREATE_CONFIG.allowedComponentIds.has(id),
    )
    if (invalidComponent) return `Invalid componentId: ${invalidComponent}`
    if (data.pilarId && !ALLOWED_PILARES_OPTION_IDS.has(data.pilarId)) {
      return `Invalid pilarId: ${data.pilarId}`
    }
    if (data.parentKey && data.issueTypeId === STORY_CREATE_CONFIG.epicIssueTypeId) {
      return 'Parent cannot be set when work type is Epica'
    }
    return null
  }

  // GET /api/jira/issues/:issueKey/media/:fileId — proxy ADF description images
  fastify.get(
    '/issues/:issueKey/media/:fileId',
    async (
      req: FastifyRequest<{ Params: { issueKey: string; fileId: string } }>,
      reply,
    ) => {
      const parsedKey = parseJiraIssueKey(req.params.issueKey)
      if (!parsedKey) {
        return reply.status(400).send({ error: 'Invalid issue key or URL' })
      }
      const fileId = String(req.params.fileId ?? '').trim()
      if (!fileId) {
        return reply.status(400).send({ error: 'Missing media file id' })
      }

      const result = await fetchIssueMediaBinary(parsedKey, fileId)
      if (!result.ok) return sendJiraError(reply, result.error)

      return reply
        .header('Content-Type', result.contentType)
        .header('Cache-Control', 'private, max-age=300')
        .send(result.data)
    },
  )

  // GET /api/jira/stories/:issueKey — load editable CDPM issue
  fastify.get(
    '/stories/:issueKey',
    async (req: FastifyRequest<{ Params: { issueKey: string } }>, reply) => {
      const parsedKey = parseJiraIssueKey(req.params.issueKey)
      if (!parsedKey) {
        return reply.status(400).send({ error: 'Invalid issue key or URL' })
      }

      const result = await jira.get<{
        id?: string
        key?: string
        fields?: Record<string, unknown>
      }>(
        `/rest/api/3/issue/${encodeURIComponent(parsedKey)}?fields=${STORY_EDIT_FIELDS}`,
      )
      if (!result.ok) return sendJiraError(reply, result.error)

      const fields = result.data.fields ?? {}
      const project = fields.project as { key?: string } | undefined
      const projectKey = String(project?.key ?? '')
      if (projectKey !== STORY_CREATE_CONFIG.projectKey) {
        return reply.status(400).send({
          error: `Solo se pueden editar issues del proyecto ${STORY_CREATE_CONFIG.projectKey}`,
        })
      }

      const issuetype = fields.issuetype as { id?: string; name?: string } | undefined
      const issueTypeId = String(issuetype?.id ?? '')
      if (!ALLOWED_ISSUE_TYPE_IDS.has(issueTypeId)) {
        return reply.status(400).send({
          error: `Work type no soportado: ${issuetype?.name ?? issueTypeId}`,
        })
      }

      const componentsRaw = Array.isArray(fields.components) ? fields.components : []
      const componentIds = componentsRaw
        .map((c) => String((c as { id?: string })?.id ?? ''))
        .filter((id) => id && STORY_CREATE_CONFIG.allowedComponentIds.has(id))

      const parent = fields.parent as
        | { key?: string; fields?: { summary?: string } }
        | undefined
      const epicLink = fields[STORY_CREATE_CONFIG.epicLinkField]
      const parentKey =
        String(parent?.key ?? '').toUpperCase() ||
        (typeof epicLink === 'string' ? epicLink.toUpperCase() : '') ||
        null

      const pilares = fields[STORY_CREATE_CONFIG.pilaresField] as
        | { id?: string; value?: string }
        | null
        | undefined
      const storyPointsRaw = fields[STORY_CREATE_CONFIG.storyPointsField]
      const storyPoints =
        typeof storyPointsRaw === 'number' && Number.isFinite(storyPointsRaw)
          ? Math.trunc(storyPointsRaw)
          : null

      const status = fields.status as { name?: string } | undefined
      const env = getEnv()
      const baseUrl = env.JIRA_BASE_URL.replace(/\/$/, '')
      const key = String(result.data.key ?? parsedKey)

      const acceptanceRaw = fields[STORY_CREATE_CONFIG.acceptanceCriteriaField]
      const acceptanceCriteria =
        typeof acceptanceRaw === 'string'
          ? acceptanceRaw
          : acceptanceRaw
            ? adfToMarkdown(acceptanceRaw, { issueKey: key })
            : ''

      return reply.send({
        id: String(result.data.id ?? ''),
        key,
        url: `${baseUrl}/browse/${key}`,
        statusName: String(status?.name ?? ''),
        summary: String(fields.summary ?? ''),
        description: adfToMarkdown(fields.description, { issueKey: key }),
        issueTypeId,
        issueTypeName: String(issuetype?.name ?? ''),
        componentIds,
        valor: adfToMarkdown(fields[STORY_CREATE_CONFIG.valorField]) || 'A definir',
        parentKey,
        parentSummary: parent?.fields?.summary ? String(parent.fields.summary) : null,
        pilarId: pilares?.id ? String(pilares.id) : null,
        pilarValue: pilares?.value ? String(pilares.value) : null,
        storyPoints,
        acceptanceCriteria,
      })
    },
  )

  // PUT /api/jira/stories/:issueKey
  fastify.put(
    '/stories/:issueKey',
    async (req: FastifyRequest<{ Params: { issueKey: string } }>, reply) => {
      const parsedKey = parseJiraIssueKey(req.params.issueKey)
      if (!parsedKey) {
        return reply.status(400).send({ error: 'Invalid issue key or URL' })
      }

      const parsed = updateStorySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
      }

      const validationError = validateStoryPayload(parsed.data)
      if (validationError) {
        return reply.status(400).send({ error: validationError })
      }

      const backupMarkdown = buildFieldBackupCommentMarkdown(parsed.data.fieldBackup)
      if (backupMarkdown) {
        const commentResult = await jira.post<unknown>(
          `/rest/api/3/issue/${encodeURIComponent(parsedKey)}/comment`,
          { body: markdownToAdf(backupMarkdown) },
        )
        if (!commentResult.ok) return sendJiraError(reply, commentResult.error)
      }

      const fields = buildStoryFields(parsed.data, { includeProject: false })
      const result = await jira.put<unknown>(
        `/rest/api/3/issue/${encodeURIComponent(parsedKey)}`,
        { fields },
      )
      if (!result.ok) return sendJiraError(reply, result.error)

      const env = getEnv()
      const baseUrl = env.JIRA_BASE_URL.replace(/\/$/, '')
      return reply.send({
        id: '',
        key: parsedKey,
        url: `${baseUrl}/browse/${parsedKey}`,
      })
    },
  )

  // POST /api/jira/stories
  fastify.post('/stories', async (req: FastifyRequest, reply) => {
    const parsed = createStorySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
    }

    const validationError = validateStoryPayload(parsed.data)
    if (validationError) {
      return reply.status(400).send({ error: validationError })
    }

    const fields = buildStoryFields(parsed.data, { includeProject: true })
    // Only set parent object when creating with a parent (omit when empty)
    if (!parsed.data.parentKey) {
      delete fields.parent
      delete fields[STORY_CREATE_CONFIG.epicLinkField]
    }
    if (parsed.data.storyPoints === null) {
      delete fields[STORY_CREATE_CONFIG.storyPointsField]
    }
    if (!parsed.data.acceptanceCriteria) {
      delete fields[STORY_CREATE_CONFIG.acceptanceCriteriaField]
    }
    if (!parsed.data.pilarId) {
      delete fields[STORY_CREATE_CONFIG.pilaresField]
    }
    if (!parsed.data.description.trim()) {
      delete fields.description
    }

    const result = await jira.post<{ id?: string; key?: string }>(
      '/rest/api/3/issue',
      { fields },
    )
    if (!result.ok) return sendJiraError(reply, result.error)

    const key = String(result.data.key ?? '')
    const id = String(result.data.id ?? '')
    const baseUrl = env.JIRA_BASE_URL.replace(/\/$/, '')

    return reply.status(201).send({
      id,
      key,
      url: key ? `${baseUrl}/browse/${key}` : null,
    })
  })
}

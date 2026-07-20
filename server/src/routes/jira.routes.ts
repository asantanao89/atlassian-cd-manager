import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getEnv } from '../env'
import { getJiraClient } from '../jira/jiraClient'
import { normalizeIssue, normalizeIssueWithWorklogs, normalizeWorklog } from '../jira/jiraNormalizer'
import { sendJiraError } from '../jira/jiraErrors'
import {
  searchIssuesSchema,
  createWorklogSchema,
  updateWorklogSchema,
  updateTimetrackingSchema,
  transitionIssueSchema,
  createStorySchema,
  updateStorySchema,
  listStoryParentsSchema,
} from '../schemas/jira.schemas'
import { ALLOWED_ISSUE_TYPE_IDS, ALLOWED_PILARES_OPTION_IDS, STORY_CREATE_CONFIG } from '../jira/storyCreateConfig'
import { parseJiraIssueKey } from '../jira/parseIssueKey'
import { buildFieldBackupCommentMarkdown } from '../jira/buildFieldBackupComment'
import { adfToMarkdown, buildAdfComment, markdownToAdf } from '../utils/adf'

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

function parseOpenPullRequests(payload: unknown): OpenPullRequest[] {
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
      if (status && status !== 'OPEN') continue

      const author = pr.author as Record<string, unknown> | null | undefined
      const repository = pr.destination as Record<string, unknown> | null | undefined
      const source = pr.source as Record<string, unknown> | null | undefined

      const idValue = pr.id ?? pr.url ?? pr.name ?? pr.title
      const id = String(idValue ?? '').trim()
      if (!id) continue

      openPullRequests.push({
        id,
        title: String(pr.name ?? pr.title ?? id),
        url: typeof pr.url === 'string' && pr.url.trim().length > 0 ? pr.url : null,
        state: status,
        sourceBranch:
          typeof source?.branch === 'string' && source.branch.trim().length > 0 ? source.branch : null,
        targetBranch:
          typeof repository?.branch === 'string' && repository.branch.trim().length > 0
            ? repository.branch
            : null,
        repository:
          typeof repository?.name === 'string' && repository.name.trim().length > 0
            ? repository.name
            : null,
        author:
          typeof author?.name === 'string' && author.name.trim().length > 0 ? author.name : null,
      })
    }
  }

  const deduped = new Map<string, OpenPullRequest>()
  for (const pr of openPullRequests) {
    deduped.set(pr.id, pr)
  }

  return Array.from(deduped.values())
}

async function fetchOpenPullRequestsForIssueId(
  jira: ReturnType<typeof getJiraClient>,
  issueId: string,
): Promise<OpenPullRequest[]> {
  const applicationTypes = ['bitbucket', 'github', 'gitlab', 'stash']
  const allPullRequests: OpenPullRequest[] = []

  for (const applicationType of applicationTypes) {
    const result = await jira.get<Record<string, unknown>>(
      `/rest/dev-status/latest/issue/detail?issueId=${encodeURIComponent(issueId)}&applicationType=${encodeURIComponent(applicationType)}&dataType=pullrequest`,
    )
    if (!result.ok) continue
    allPullRequests.push(...parseOpenPullRequests(result.data))
  }

  const deduped = new Map<string, OpenPullRequest>()
  for (const pr of allPullRequests) deduped.set(pr.id, pr)
  return Array.from(deduped.values())
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

  // POST /api/jira/issues/search
  fastify.post('/issues/search', async (req: FastifyRequest, reply) => {
    const parsed = searchIssuesSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
    }
    const { jql, maxResults, nextPageToken, includeWorklogs } = parsed.data

    const fields = ['summary', 'status', 'issuetype', 'parent', 'subtasks', 'timetracking', 'assignee', 'updated']
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

      return reply.send({ pullRequests: await fetchOpenPullRequestsForIssueId(jira, issueId) })
    },
  )

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

      const acceptanceRaw = fields[STORY_CREATE_CONFIG.acceptanceCriteriaField]
      const acceptanceCriteria =
        typeof acceptanceRaw === 'string'
          ? acceptanceRaw
          : acceptanceRaw
            ? adfToMarkdown(acceptanceRaw)
            : ''

      const status = fields.status as { name?: string } | undefined
      const env = getEnv()
      const baseUrl = env.JIRA_BASE_URL.replace(/\/$/, '')
      const key = String(result.data.key ?? parsedKey)

      return reply.send({
        id: String(result.data.id ?? ''),
        key,
        url: `${baseUrl}/browse/${key}`,
        statusName: String(status?.name ?? ''),
        summary: String(fields.summary ?? ''),
        description: adfToMarkdown(fields.description),
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

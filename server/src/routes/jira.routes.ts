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
} from '../schemas/jira.schemas'
import { buildAdfComment } from '../utils/adf'

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
}

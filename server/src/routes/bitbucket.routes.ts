import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getEnv } from '../env'
import { getBitbucketClient } from '../bitbucket/bitbucketClient'
import { sendBitbucketError, type BitbucketApiError } from '../bitbucket/bitbucketErrors'

export async function bitbucketRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/repos', async (_req, reply) => {
    const env = getEnv()
    const repos = env.BITBUCKET_REPO_SLUG
      ? env.BITBUCKET_REPO_SLUG.split(',').map((s) => s.trim()).filter(Boolean)
      : env.BITBUCKET_REPOS
        ? env.BITBUCKET_REPOS.split(',').map((s) => s.trim()).filter(Boolean)
        : []

    reply.send({ repos })
  })

  // GET /api/bitbucket/pull-requests/branches
  fastify.get(
    '/pull-requests/branches',
    async (req: FastifyRequest<{ Querystring: { q?: string } }>, reply) => {
      const env = getEnv()
      if (!env.BITBUCKET_WORKSPACE || !env.BITBUCKET_REPO_SLUG) {
        reply.status(503).send({
          error: 'Bitbucket no está configurado. Define BITBUCKET_WORKSPACE y BITBUCKET_REPO_SLUG.',
        })
        return
      }

      const repoSlug = env.BITBUCKET_REPO_SLUG.split(',')[0].trim()
      const client = getBitbucketClient()

      try {
        const branches = await client.listBranches(repoSlug, req.query.q)
        reply.send({ repoSlug, branches })
      } catch (err) {
        sendBitbucketError(reply, err as BitbucketApiError)
      }
    },
  )

  // GET /api/bitbucket/repos/:repoSlug/branches
  fastify.get(
    '/repos/:repoSlug/branches',
    async (req: FastifyRequest<{ Params: { repoSlug: string }; Querystring: { q?: string } }>, reply) => {
      const env = getEnv()
      if (!env.BITBUCKET_WORKSPACE) {
        reply.status(503).send({ error: 'Bitbucket no está configurado. Define BITBUCKET_WORKSPACE.' })
        return
      }

      const { repoSlug } = req.params
      const client = getBitbucketClient()

      try {
        const branches = await client.listBranches(repoSlug, req.query.q)
        reply.send({ branches })
      } catch (err) {
        sendBitbucketError(reply, err as BitbucketApiError)
      }
    },
  )

  // POST /api/bitbucket/repos/:repoSlug/branches
  fastify.post(
    '/repos/:repoSlug/branches',
    async (req: FastifyRequest<{ Params: { repoSlug: string }; Body: { name: string; startPoint: string } }>, reply) => {
      const env = getEnv()
      if (!env.BITBUCKET_WORKSPACE) {
        reply.status(503).send({ error: 'Bitbucket no está configurado. Define BITBUCKET_WORKSPACE.' })
        return
      }

      const { repoSlug } = req.params
      const { name, startPoint } = req.body

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        reply.status(400).send({ error: 'El nombre de la rama es requerido.' })
        return
      }
      if (!startPoint || typeof startPoint !== 'string' || startPoint.trim().length === 0) {
        reply.status(400).send({ error: 'El punto de partida (startPoint) es requerido.' })
        return
      }

      const client = getBitbucketClient()

      try {
        const branch = await client.createBranch(repoSlug, name.trim(), startPoint.trim())
        reply.status(201).send({ branch: branch.name })
      } catch (err) {
        sendBitbucketError(reply, err as BitbucketApiError)
      }
    },
  )

  // GET /api/bitbucket/repos/:repoSlug/commits?source=X&target=Y
  fastify.get(
    '/repos/:repoSlug/commits',
    async (req: FastifyRequest<{ Params: { repoSlug: string }; Querystring: { source?: string; target?: string } }>, reply) => {
      const env = getEnv()
      if (!env.BITBUCKET_WORKSPACE) {
        reply.status(503).send({ error: 'Bitbucket no está configurado. Define BITBUCKET_WORKSPACE.' })
        return
      }

      const { repoSlug } = req.params
      const { source, target } = req.query

      if (!source || !target) {
        reply.status(400).send({ error: 'Los parámetros source y target son requeridos.' })
        return
      }

      const client = getBitbucketClient()

      try {
        const commits = await client.listCommits(repoSlug, source, target)
        reply.send({ commits })
      } catch (err) {
        sendBitbucketError(reply, err as BitbucketApiError)
      }
    },
  )

  // POST /api/bitbucket/pull-requests
  fastify.post(
    '/pull-requests',
    async (req: FastifyRequest<{ Body: { repoSlug?: string; sourceBranch: string; targetBranch: string; title: string; description?: string } }>, reply) => {
      const env = getEnv()
      if (!env.BITBUCKET_WORKSPACE) {
        reply.status(503).send({ error: 'Bitbucket no está configurado. Define BITBUCKET_WORKSPACE.' })
        return
      }

      const { sourceBranch, targetBranch, title, description } = req.body
      const repoSlug = req.body.repoSlug || (env.BITBUCKET_REPO_SLUG?.split(',')[0].trim() ?? '')

      if (!repoSlug) {
        reply.status(400).send({ error: 'El repositorio es requerido.' })
        return
      }
      if (!sourceBranch || !targetBranch || !title) {
        reply.status(400).send({ error: 'sourceBranch, targetBranch y title son requeridos.' })
        return
      }
      if (sourceBranch === targetBranch) {
        reply.status(400).send({ error: 'La rama origen y destino deben ser diferentes.' })
        return
      }

      const client = getBitbucketClient()

      try {
        const pr = await client.createPullRequest(repoSlug, {
          title,
          sourceBranch,
          targetBranch,
          description,
        })

        reply.status(201).send({
          id: String(pr.id),
          title: pr.title,
          url: pr.links.html.href,
          state: pr.state,
          sourceBranch: pr.source.branch.name,
          targetBranch: pr.destination.branch.name,
          repository: repoSlug,
          author: pr.author?.display_name ?? null,
        })
      } catch (err) {
        sendBitbucketError(reply, err as BitbucketApiError)
      }
    },
  )
}

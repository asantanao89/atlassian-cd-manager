import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getEnv } from '../env'
import { improveFieldSchema } from '../schemas/ai.schemas'

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  const env = getEnv()

  // GET /api/ai/status — probes the laptop Codex worker through the SSH tunnel
  fastify.get('/status', async (_req, reply) => {
    const workerUrl = env.CODEX_WORKER_URL?.replace(/\/$/, '')
    const configured = Boolean(workerUrl && env.CODEX_WORKER_TOKEN)

    if (!configured || !workerUrl) {
      return reply.send({
        configured: false,
        available: false,
        reason: 'not_configured' as const,
      })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2_500)

    try {
      const response = await fetch(`${workerUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      })
      if (!response.ok) {
        return reply.send({
          configured: true,
          available: false,
          reason: 'unhealthy' as const,
        })
      }
      return reply.send({
        configured: true,
        available: true,
        reason: 'ok' as const,
      })
    } catch {
      return reply.send({
        configured: true,
        available: false,
        reason: 'unreachable' as const,
      })
    } finally {
      clearTimeout(timeout)
    }
  })

  // POST /api/ai/improve-summary (generic field improve; name kept for compatibility)
  fastify.post('/improve-summary', async (req: FastifyRequest, reply) => {
    const workerUrl = env.CODEX_WORKER_URL?.replace(/\/$/, '')
    const workerToken = env.CODEX_WORKER_TOKEN

    if (!workerUrl || !workerToken) {
      return reply.status(503).send({
        error:
          'Codex worker no configurado. Define CODEX_WORKER_URL y CODEX_WORKER_TOKEN en server/.env.',
      })
    }

    const parsed = improveFieldSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 95_000)

    try {
      const response = await fetch(`${workerUrl}/improve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${workerToken}`,
        },
        body: JSON.stringify(parsed.data),
        signal: controller.signal,
      })

      const text = await response.text()
      let data: unknown = null
      if (text) {
        try {
          data = JSON.parse(text) as unknown
        } catch {
          data = { error: text.slice(0, 500) }
        }
      }

      if (!response.ok) {
        const message =
          data && typeof data === 'object' && data !== null && 'error' in data
            ? String((data as { error: unknown }).error)
            : `Codex worker error (${response.status})`
        const status = response.status === 401 || response.status === 400 ? response.status : 502
        return reply.status(status).send({ error: message })
      }

      const result = data as {
        improvedValue?: string
        improvedSummary?: string
        rationale?: string
        missingSections?: unknown
        followUpQuestions?: unknown
      }
      const improvedValue = String(result.improvedValue ?? result.improvedSummary ?? '').trim()
      if (!improvedValue) {
        return reply.status(502).send({ error: 'Codex worker returned an empty value' })
      }

      const missingSections = Array.isArray(result.missingSections)
        ? result.missingSections.map((s) => String(s).trim()).filter(Boolean)
        : []
      const followUpQuestions = Array.isArray(result.followUpQuestions)
        ? result.followUpQuestions.map((s) => String(s).trim()).filter(Boolean)
        : []

      return reply.send({
        improvedValue,
        improvedSummary: improvedValue,
        rationale: result.rationale ? String(result.rationale) : undefined,
        missingSections,
        followUpQuestions,
      })
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError'
      if (aborted) {
        return reply.status(504).send({ error: 'Timeout esperando al Codex worker' })
      }
      return reply.status(503).send({
        error:
          'Worker/túnel no disponible. Comprueba que el worker del laptop y los túneles SSH estén activos.',
      })
    } finally {
      clearTimeout(timeout)
    }
  })
}

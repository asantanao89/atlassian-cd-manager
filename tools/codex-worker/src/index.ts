import http from 'node:http'
import { z } from 'zod'
import { buildImprovePrompt, type ImproveFieldId } from './prompt.js'
import { CodexExecError, runCodexImprove } from './runCodex.js'

const PORT = Number(process.env.CODEX_WORKER_PORT ?? 9876)
const TOKEN = process.env.CODEX_WORKER_TOKEN ?? ''
const HOST = process.env.CODEX_WORKER_HOST ?? '127.0.0.1'

const improveBodySchema = z.object({
  fields: z.array(z.enum(['summary', 'description', 'acceptanceCriteria'])).min(1),
  summary: z.string(),
  description: z.string().default(''),
  acceptanceCriteria: z.string().default(''),
  componentName: z.string().nullable(),
  valor: z.string(),
  projectKey: z.string(),
  projectName: z.string(),
  issueTypeName: z.string(),
  unOptionValue: z.string(),
})

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function isAuthorized(req: http.IncomingMessage): boolean {
  if (!TOKEN) return false
  const header = req.headers.authorization ?? ''
  return header === `Bearer ${TOKEN}`
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method === 'POST' && url.pathname === '/improve') {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { error: 'Unauthorized' })
      return
    }

    try {
      const rawBody = await readJson(req)
      const parsed = improveBodySchema.safeParse(rawBody)
      if (!parsed.success) {
        sendJson(res, 400, { error: 'Invalid request', details: parsed.error.errors })
        return
      }

      const { fields, ...context } = parsed.data
      const prompt = buildImprovePrompt(fields as ImproveFieldId[], context)
      if (!prompt.trim()) {
        sendJson(res, 400, { error: 'Empty prompt' })
        return
      }

      const result = await runCodexImprove(prompt)
      sendJson(res, 200, {
        improvedValue: result.improvedValue,
        // Back-compat for older clients
        improvedSummary: result.improvedValue,
        missingSections: result.missingSections,
        followUpQuestions: result.followUpQuestions,
      })
    } catch (err) {
      if (err instanceof CodexExecError) {
        sendJson(res, 502, { error: err.message })
        return
      }
      const message = err instanceof Error ? err.message : 'Internal worker error'
      sendJson(res, 500, { error: message })
    }
    return
  }

  sendJson(res, 404, { error: 'Not found' })
})

if (!TOKEN) {
  console.error('❌ CODEX_WORKER_TOKEN is required')
  process.exit(1)
}

server.listen(PORT, HOST, () => {
  console.log(`✅ Codex worker listening on http://${HOST}:${PORT}`)
  console.log('   Endpoints: GET /health, POST /improve')
  console.log('   Output schema: improvedValue, missingSections, followUpQuestions')
})

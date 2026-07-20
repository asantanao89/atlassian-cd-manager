import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface CodexImproveResult {
  improvedValue: string
  missingSections: string[]
  followUpQuestions: string[]
}

export class CodexExecError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CodexExecError'
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0)
}

export async function runCodexImprove(
  prompt: string,
  timeoutMs = 90_000,
): Promise<CodexImproveResult> {
  // Resolve schema on each call so file updates apply without weird caches.
  const schemaPath = path.resolve(__dirname, '../summary.schema.json')
  const schemaRaw = await fs.readFile(schemaPath, 'utf8')
  const schemaJson = JSON.parse(schemaRaw) as {
    required?: string[]
    properties?: Record<string, unknown>
  }
  const required = schemaJson.required ?? []
  const propertyKeys = Object.keys(schemaJson.properties ?? {})
  const missingRequired = propertyKeys.filter((key) => !required.includes(key))
  if (missingRequired.length > 0) {
    throw new CodexExecError(
      `Invalid summary.schema.json: properties missing from required: ${missingRequired.join(', ')} (${schemaPath})`,
    )
  }

  const outFile = path.join(
    os.tmpdir(),
    `codex-improve-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  )

  const model = (process.env.CODEX_MODEL ?? '').trim()
  const args = [
    'exec',
    '--ephemeral',
    '--sandbox',
    'read-only',
    ...(model ? (['-m', model] as const) : []),
    '--output-schema',
    schemaPath,
    '-o',
    outFile,
    '-',
  ]

  try {
    await new Promise<void>((resolve, reject) => {
      // Pass prompt via stdin (`-`) so Codex does not hang waiting for
      // "additional input" on a non-TTY inherited/ignored stdin.
      const child = spawn('codex', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
      })

      let stderr = ''
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })

      child.stdin?.on('error', (err) => {
        reject(new CodexExecError(`Failed to write prompt to codex stdin: ${err.message}`))
      })
      child.stdin?.end(prompt)

      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new CodexExecError(`codex exec timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      child.on('error', (err) => {
        clearTimeout(timer)
        reject(
          new CodexExecError(
            `Failed to start codex: ${err.message}. Is the Codex CLI installed and on PATH?`,
          ),
        )
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve()
          return
        }
        const detail = stderr.trim()
        const clipped =
          detail.length > 2000 ? detail.slice(detail.length - 2000) : detail
        reject(
          new CodexExecError(
            clipped
              ? `codex exec exited with code ${code}: ${clipped}`
              : `codex exec exited with code ${code}`,
          ),
        )
      })
    })

    const raw = await fs.readFile(outFile, 'utf8')
    let parsed: {
      improvedValue?: string
      improvedSummary?: string
      missingSections?: unknown
      followUpQuestions?: unknown
    }
    try {
      parsed = JSON.parse(raw) as typeof parsed
    } catch {
      throw new CodexExecError(
        `codex output is not valid JSON: ${raw.trim().slice(0, 500)}`,
      )
    }
    const improvedValue = String(parsed.improvedValue ?? parsed.improvedSummary ?? '').trim()
    if (!improvedValue) {
      throw new CodexExecError(
        `codex output missing improvedValue (keys: ${Object.keys(parsed).join(', ') || 'none'}; raw: ${raw.trim().slice(0, 300)})`,
      )
    }

    return {
      improvedValue,
      missingSections: asStringArray(parsed.missingSections),
      followUpQuestions: asStringArray(parsed.followUpQuestions),
    }
  } finally {
    await fs.unlink(outFile).catch(() => undefined)
  }
}

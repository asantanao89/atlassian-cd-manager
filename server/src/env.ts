import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

const envSchema = z.object({
  JIRA_BASE_URL: z.string().url('JIRA_BASE_URL must be a valid URL'),
  JIRA_EMAIL: z.string().email('JIRA_EMAIL must be a valid email'),
  JIRA_API_TOKEN: z.string().min(1, 'JIRA_API_TOKEN is required'),
  SERVER_PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_ORIGIN: z.string().url('CLIENT_ORIGIN must be a valid URL').default('http://localhost:5173'),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | null = null
let _dotenvLoaded = false

function loadDotEnvFiles(): void {
  if (_dotenvLoaded) return

  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd, '.env'),
    path.resolve(cwd, 'server/.env'),
  ]

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath })
    }
  }

  _dotenvLoaded = true
}

export function getEnv(): Env {
  if (_env) return _env
  loadDotEnvFiles()

  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ Invalid or missing environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    console.error('\nCreate server/.env from .env.example and fill in the values.')
    process.exit(1)
  }

  _env = result.data
  return _env
}

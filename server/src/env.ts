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
  BITBUCKET_BASE_URL: z
    .string()
    .url('BITBUCKET_BASE_URL must be a valid URL')
    .optional(),
  BITBUCKET_API_TOKEN: z.string().min(1, 'BITBUCKET_API_TOKEN is required').optional(),
  BITBUCKET_API_USER: z.string().min(1, 'BITBUCKET_API_USER is required').optional(),
  BITBUCKET_APP_PASSWORD: z.string().min(1, 'BITBUCKET_APP_PASSWORD is required').optional(),
  BITBUCKET_USERNAME: z.string().min(1, 'BITBUCKET_USERNAME is required').optional(),
  BITBUCKET_WORKSPACE: z.string().min(1, 'BITBUCKET_WORKSPACE is required').optional(),
  BITBUCKET_REPO_SLUG: z.string().min(1, 'BITBUCKET_REPO_SLUG is required').optional(),
  BITBUCKET_REPOS: z.string().optional(),
  DISCORD_CHANNELS: z.string().optional(),
})

const discordChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  webhookUrl: z.string().url(),
})

export interface DiscordChannelConfig {
  id: string
  name: string
  webhookUrl: string
}

type RawEnv = z.infer<typeof envSchema>

export interface Env extends RawEnv {
  BITBUCKET_API_TOKEN?: string
  BITBUCKET_API_USER?: string
  discordChannels: DiscordChannelConfig[]
}

function parseDiscordChannels(raw: string | undefined): DiscordChannelConfig[] {
  if (!raw?.trim()) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    return z.array(discordChannelSchema).parse(parsed)
  } catch {
    console.warn('⚠️ DISCORD_CHANNELS is invalid JSON or schema; Discord notifications disabled.')
    return []
  }
}

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

function resolveBitbucketApiUser(data: z.infer<typeof envSchema>): string | undefined {
  const user = data.BITBUCKET_API_USER ?? data.BITBUCKET_USERNAME
  const token = data.BITBUCKET_API_TOKEN ?? data.BITBUCKET_APP_PASSWORD
  // Atlassian API tokens (ATATT...) require the account email for Bitbucket REST auth.
  if (token?.startsWith('ATATT') && user && !user.includes('@')) {
    return data.JIRA_EMAIL
  }
  return user
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

  const data = result.data
  _env = {
    ...data,
    BITBUCKET_API_TOKEN: data.BITBUCKET_API_TOKEN ?? data.BITBUCKET_APP_PASSWORD,
    BITBUCKET_API_USER: resolveBitbucketApiUser(data),
    discordChannels: parseDiscordChannels(data.DISCORD_CHANNELS),
  }
  return _env
}

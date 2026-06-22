import { getEnv } from '../env'
import { mapJiraError, type JiraApiError } from './jiraErrors'

type RequestResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: JiraApiError }

class JiraClient {
  private readonly baseUrl: string
  private readonly authHeader: string

  constructor() {
    const env = getEnv()
    this.baseUrl = env.JIRA_BASE_URL.replace(/\/$/, '')
    const token = Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString('base64')
    // Never log this header
    this.authHeader = `Basic ${token}`
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  private networkError(): RequestResult<never> {
    return {
      ok: false,
      error: {
        statusCode: 503,
        message: 'No se pudo conectar con Jira. Verifica JIRA_BASE_URL y la conexión de red.',
      },
    }
  }

  async get<T>(path: string): Promise<RequestResult<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      })
      const data = (await response.json()) as unknown
      if (!response.ok) return { ok: false, error: mapJiraError(response.status, data) }
      return { ok: true, data: data as T, status: response.status }
    } catch {
      return this.networkError()
    }
  }

  async post<T>(path: string, body: unknown): Promise<RequestResult<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      })
      const text = await response.text()
      const data = text ? (JSON.parse(text) as unknown) : null
      if (!response.ok) return { ok: false, error: mapJiraError(response.status, data) }
      return { ok: true, data: data as T, status: response.status }
    } catch {
      return this.networkError()
    }
  }

  async put<T>(path: string, body: unknown): Promise<RequestResult<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'PUT',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      })
      const text = await response.text()
      const data = text ? (JSON.parse(text) as unknown) : null
      if (!response.ok) return { ok: false, error: mapJiraError(response.status, data) }
      return { ok: true, data: data as T, status: response.status }
    } catch {
      return this.networkError()
    }
  }

  async delete(path: string): Promise<RequestResult<null>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'DELETE',
        headers: this.buildHeaders(),
      })
      if (!response.ok) {
        const text = await response.text()
        const data = text ? (JSON.parse(text) as unknown) : null
        return { ok: false, error: mapJiraError(response.status, data) }
      }
      return { ok: true, data: null, status: response.status }
    } catch {
      return this.networkError()
    }
  }
}

let _client: JiraClient | null = null

export function getJiraClient(): JiraClient {
  if (!_client) _client = new JiraClient()
  return _client
}

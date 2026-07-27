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

  /**
   * GET that does not follow redirects — used to read Location (media file id).
   */
  async getRedirectLocation(path: string): Promise<RequestResult<string | null>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Authorization: this.authHeader,
          Accept: '*/*',
        },
      })
      if (response.status >= 300 && response.status < 400) {
        return {
          ok: true,
          data: response.headers.get('location'),
          status: response.status,
        }
      }
      if (!response.ok) {
        let data: unknown = null
        try {
          data = await response.json()
        } catch {
          data = null
        }
        return { ok: false, error: mapJiraError(response.status, data) }
      }
      // Some environments may follow / omit Location; fall back to final URL if present.
      return { ok: true, data: response.url || null, status: response.status }
    } catch {
      return this.networkError()
    }
  }

  async getBinary(
    path: string,
  ): Promise<
    | { ok: true; data: Buffer; contentType: string; status: number }
    | { ok: false; error: JiraApiError }
  > {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Authorization: this.authHeader,
          Accept: '*/*',
        },
      })
      if (!response.ok) {
        let data: unknown = null
        try {
          data = await response.json()
        } catch {
          data = null
        }
        return { ok: false, error: mapJiraError(response.status, data) }
      }
      const contentType =
        response.headers.get('content-type') || 'application/octet-stream'
      const ab = await response.arrayBuffer()
      return {
        ok: true,
        data: Buffer.from(ab),
        contentType,
        status: response.status,
      }
    } catch {
      return {
        ok: false,
        error: {
          statusCode: 503,
          message: 'No se pudo conectar con Jira. Verifica JIRA_BASE_URL y la conexión de red.',
        },
      }
    }
  }
}

let _client: JiraClient | null = null

export function getJiraClient(): JiraClient {
  if (!_client) _client = new JiraClient()
  return _client
}

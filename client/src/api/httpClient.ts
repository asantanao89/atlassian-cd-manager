const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown[],
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

interface ApiErrorBody {
  error?: string
  details?: unknown[]
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) return null as T

  const data = (await response.json()) as ApiErrorBody

  if (!response.ok) {
    throw new HttpError(response.status, data.error ?? `HTTP ${response.status}`, data.details)
  }

  return data as T
}

export const httpClient = {
  get: <T>(path: string): Promise<T> => request<T>('GET', path),
  post: <T>(path: string, body: unknown): Promise<T> => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown): Promise<T> => request<T>('PUT', path, body),
  delete: <T>(path: string): Promise<T> => request<T>('DELETE', path),
}

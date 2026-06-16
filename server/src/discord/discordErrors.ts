import type { FastifyReply } from 'fastify'

export interface DiscordApiError {
  statusCode: number
  message: string
}

export function mapDiscordError(status: number, body: unknown): DiscordApiError {
  const msg =
    body && typeof body === 'object' && typeof (body as Record<string, unknown>).message === 'string'
      ? ((body as Record<string, unknown>).message as string)
      : undefined

  switch (status) {
    case 400:
      return {
        statusCode: 400,
        message: msg ?? 'Discord ha rechazado el mensaje.',
      }
    case 404:
      return {
        statusCode: 404,
        message: 'Canal de Discord no encontrado.',
      }
    case 429:
      return {
        statusCode: 429,
        message: 'Discord ha limitado las solicitudes (rate limit). Espera unos segundos.',
      }
    default: {
      const mapped = status >= 500 ? 502 : status
      return {
        statusCode: mapped,
        message: msg ?? `Error inesperado de Discord (HTTP ${status}).`,
      }
    }
  }
}

export function sendDiscordError(reply: FastifyReply, error: DiscordApiError): void {
  reply.status(error.statusCode).send({ error: error.message })
}

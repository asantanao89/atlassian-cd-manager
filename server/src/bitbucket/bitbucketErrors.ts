import type { FastifyReply } from 'fastify'

export interface BitbucketApiError {
  statusCode: number
  message: string
}

export function mapBitbucketError(status: number, body: unknown): BitbucketApiError {
  const detail =
    body && typeof body === 'object'
      ? ((body as Record<string, unknown>).error as Record<string, unknown> | undefined)
      : undefined

  const msg =
    detail && typeof detail.message === 'string' ? detail.message : undefined

  switch (status) {
    case 400:
      return {
        statusCode: 400,
        message: msg ?? 'Bitbucket ha rechazado la solicitud.',
      }
    case 401:
      return {
        statusCode: 401,
        message:
          'Autenticación inválida. Con API tokens de Atlassian (ATATT...), BITBUCKET_API_USER debe ser tu email de Atlassian, no tu username de Bitbucket.',
      }
    case 403:
      return {
        statusCode: 403,
        message: 'El App Password no tiene permisos suficientes sobre este repositorio.',
      }
    case 404:
      return {
        statusCode: 404,
        message: msg ?? 'El repositorio o la rama no fue encontrado en Bitbucket.',
      }
    case 409:
      return {
        statusCode: 409,
        message: msg ?? 'La rama ya existe en el repositorio.',
      }
    case 429:
      return {
        statusCode: 429,
        message: 'Bitbucket ha limitado las solicitudes (rate limit). Espera unos segundos.',
      }
    default: {
      const mapped = status >= 500 ? 502 : status
      return {
        statusCode: mapped,
        message: msg ?? `Error inesperado de Bitbucket (HTTP ${status}).`,
      }
    }
  }
}

export function sendBitbucketError(reply: FastifyReply, error: BitbucketApiError): void {
  reply.status(error.statusCode).send({ error: error.message })
}

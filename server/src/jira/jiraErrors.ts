import type { FastifyReply } from 'fastify'

export interface JiraApiError {
  statusCode: number
  message: string
  jiraErrors?: string[]
}

export function mapJiraError(status: number, body: unknown): JiraApiError {
  const messages: string[] = []

  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    if (typeof b.message === 'string') messages.push(b.message)
    if (Array.isArray(b.errorMessages)) {
      messages.push(...(b.errorMessages as string[]))
    }
    if (b.errors && typeof b.errors === 'object') {
      for (const [field, msg] of Object.entries(b.errors as Record<string, string>)) {
        messages.push(`${field}: ${msg}`)
      }
    }
  }

  switch (status) {
    case 400:
      return {
        statusCode: 400,
        message: messages.length
          ? `Jira ha rechazado la solicitud: ${messages.join('. ')}`
          : 'Jira ha rechazado la solicitud. Es posible que el campo Time Tracking no esté en la pantalla de edición del issue.',
        jiraErrors: messages,
      }
    case 401:
      return {
        statusCode: 401,
        message: 'La sesión con Jira no es válida. Revisa JIRA_EMAIL y JIRA_API_TOKEN en el servidor.',
        jiraErrors: messages,
      }
    case 403:
      return {
        statusCode: 403,
        message: 'El token no tiene permisos para trabajar sobre este proyecto o issue.',
        jiraErrors: messages,
      }
    case 404:
      return {
        statusCode: 404,
        message: 'El issue o worklog no fue encontrado en Jira.',
        jiraErrors: messages,
      }
    case 429:
      return {
        statusCode: 429,
        message: 'Jira ha limitado las solicitudes (rate limit). Espera unos segundos antes de reintentar.',
        jiraErrors: messages,
      }
    default: {
      const mapped = status >= 500 ? 502 : status
      return {
        statusCode: mapped,
        message: messages.length
          ? `Error de Jira (${status}): ${messages.join('. ')}`
          : `Error inesperado de Jira (${status}).`,
        jiraErrors: messages,
      }
    }
  }
}

export function sendJiraError(reply: FastifyReply, error: JiraApiError): void {
  reply.status(error.statusCode).send({
    error: error.message,
    details: error.jiraErrors,
  })
}

import { getEnv, type DiscordChannelConfig } from '../env'
import { mapDiscordError, type DiscordApiError } from './discordErrors'

export type RequestResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: DiscordApiError }

export interface DiscordPublicChannel {
  id: string
  name: string
}

class DiscordClient {
  private readonly channels: DiscordChannelConfig[]

  constructor(channels: DiscordChannelConfig[]) {
    this.channels = channels
  }

  isConfigured(): boolean {
    return this.channels.length > 0
  }

  listChannels(): DiscordPublicChannel[] {
    return this.channels.map(({ id, name }) => ({ id, name }))
  }

  private findChannel(channelId: string): DiscordChannelConfig | undefined {
    return this.channels.find((channel) => channel.id === channelId)
  }

  private networkError(): RequestResult<never> {
    return {
      ok: false,
      error: {
        statusCode: 503,
        message: 'No se pudo conectar con Discord. Verifica la conexión de red.',
      },
    }
  }

  async sendMessage(channelId: string, content: string): Promise<RequestResult<void>> {
    const channel = this.findChannel(channelId)
    if (!channel) {
      return {
        ok: false,
        error: {
          statusCode: 404,
          message: 'Canal de Discord no encontrado.',
        },
      }
    }

    try {
      const response = await fetch(channel.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        let body: unknown
        try {
          body = await response.json()
        } catch {
          body = undefined
        }
        return { ok: false, error: mapDiscordError(response.status, body) }
      }

      return { ok: true, data: undefined, status: response.status }
    } catch {
      return this.networkError()
    }
  }
}

let _client: DiscordClient | null = null

export function getDiscordClient(): DiscordClient {
  if (!_client) _client = new DiscordClient(getEnv().discordChannels)
  return _client
}

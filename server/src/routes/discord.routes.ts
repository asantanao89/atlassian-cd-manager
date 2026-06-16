import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getDiscordClient } from '../discord/discordClient'
import { sendDiscordError, type DiscordApiError } from '../discord/discordErrors'
import { notifyDiscordSchema } from '../schemas/discord.schemas'

export async function discordRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/channels', async (_req, reply) => {
    const client = getDiscordClient()
    if (!client.isConfigured()) {
      reply.status(503).send({
        error: 'Discord no está configurado. Define DISCORD_CHANNELS en el servidor.',
      })
      return
    }

    reply.send({ channels: client.listChannels() })
  })

  fastify.post(
    '/notify',
    async (req: FastifyRequest<{ Body: { channelId?: string; message?: string } }>, reply) => {
      const client = getDiscordClient()
      if (!client.isConfigured()) {
        reply.status(503).send({
          error: 'Discord no está configurado. Define DISCORD_CHANNELS en el servidor.',
        })
        return
      }

      const parsed = notifyDiscordSchema.safeParse(req.body)
      if (!parsed.success) {
        reply.status(400).send({ error: 'Invalid request', details: parsed.error.errors })
        return
      }

      const { channelId, message } = parsed.data

      try {
        const result = await client.sendMessage(channelId, message)
        if (!result.ok) {
          sendDiscordError(reply, result.error)
          return
        }
        reply.status(204).send()
      } catch (err) {
        sendDiscordError(reply, err as DiscordApiError)
      }
    },
  )
}

import { z } from 'zod'

export const notifyDiscordSchema = z.object({
  channelId: z.string().min(1, 'channelId is required'),
  message: z.string().min(1, 'message is required').max(2000, 'message must be at most 2000 characters'),
})

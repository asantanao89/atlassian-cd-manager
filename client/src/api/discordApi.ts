import { httpClient } from './httpClient'
import type { DiscordChannelsResponse, DiscordNotifyParams } from '../types/discord'

export const discordApi = {
  getChannels: (): Promise<DiscordChannelsResponse> =>
    httpClient.get<DiscordChannelsResponse>('/api/discord/channels'),

  notify: (params: DiscordNotifyParams): Promise<void> =>
    httpClient.post<void>('/api/discord/notify', params),
}

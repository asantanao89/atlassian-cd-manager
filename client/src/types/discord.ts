export interface DiscordChannel {
  id: string
  name: string
}

export interface DiscordChannelsResponse {
  channels: DiscordChannel[]
}

export interface DiscordNotifyParams {
  channelId: string
  message: string
}

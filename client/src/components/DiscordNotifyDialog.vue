<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { HttpError } from '../api/httpClient'
import { discordApi } from '../api/discordApi'
import { jiraApi } from '../api/jiraApi'
import type { DiscordChannel } from '../types/discord'
import type { JiraOpenPullRequest } from '../types/jira'

const props = defineProps<{
  show: boolean
  issueKey: string | null
  issueSummary: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const channels = ref<DiscordChannel[]>([])
const selectedChannelId = ref('')
const message = ref('')
const jiraBaseUrl = ref('')

const isLoading = ref(false)
const isSending = ref(false)
const loadError = ref<string | null>(null)
const sendError = ref<string | null>(null)
const sendSuccess = ref(false)

const messageLength = computed(() => message.value.length)
const canSend = computed(
  () =>
    selectedChannelId.value.length > 0
    && message.value.trim().length > 0
    && message.value.length <= 2000
    && !isLoading.value
    && !isSending.value
    && channels.value.length > 0,
)

function formatPullRequestLine(pr: JiraOpenPullRequest): string {
  const branches =
    pr.sourceBranch && pr.targetBranch
      ? ` (${pr.sourceBranch} → ${pr.targetBranch})`
      : pr.sourceBranch
        ? ` (${pr.sourceBranch})`
        : ''

  if (pr.url) {
    return `- [${pr.title}](${pr.url})${branches}`
  }

  return `- ${pr.title}${branches}`
}

function buildMessage(
  issueKey: string,
  issueSummary: string,
  baseUrl: string,
  pullRequests: JiraOpenPullRequest[],
): string {
  const jiraUrl = baseUrl ? `${baseUrl}/browse/${encodeURIComponent(issueKey)}` : issueKey
  const lines = [
    'Tarea lista para revisión',
    '',
    `Issue: ${issueKey} — ${issueSummary}`,
    `Jira: ${jiraUrl}`,
    '',
  ]

  if (pullRequests.length === 0) {
    lines.push('Pull requests: ninguno abierto')
  } else {
    lines.push('Pull requests:')
    for (const pr of pullRequests) {
      lines.push(formatPullRequestLine(pr))
    }
  }

  return lines.join('\n')
}

async function loadDialogData(): Promise<void> {
  if (!props.issueKey) return

  isLoading.value = true
  loadError.value = null
  sendError.value = null
  sendSuccess.value = false
  channels.value = []
  selectedChannelId.value = ''
  message.value = ''

  try {
    const [connectionInfo, channelsResponse, pullRequestsResponse] = await Promise.all([
      jiraApi.getConnectionInfo(),
      discordApi.getChannels(),
      jiraApi.getOpenPullRequestsForParent(props.issueKey).catch(() => ({ pullRequests: [] })),
    ])

    jiraBaseUrl.value = connectionInfo.jiraBaseUrl.replace(/\/$/, '')
    channels.value = channelsResponse.channels

    if (channelsResponse.channels.length > 0) {
      selectedChannelId.value = channelsResponse.channels[0].id
    }

    message.value = buildMessage(
      props.issueKey,
      props.issueSummary ?? props.issueKey,
      jiraBaseUrl.value,
      pullRequestsResponse.pullRequests,
    )
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 503) {
      loadError.value = error.message
    } else {
      loadError.value =
        error instanceof Error ? error.message : 'No se pudo cargar la configuración de Discord'
    }
  } finally {
    isLoading.value = false
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      void loadDialogData()
    }
  },
)

function cancel(): void {
  emit('close')
}

async function send(): Promise<void> {
  if (!canSend.value) return

  isSending.value = true
  sendError.value = null
  sendSuccess.value = false

  try {
    const baseMessage = message.value.trim()
    const outgoingMessage =
      selectedChannelId.value === 'dev-hobbit' && !baseMessage.startsWith('@Hobbit')
        ? `@Hobbit\n${baseMessage}`
        : baseMessage

    await discordApi.notify({
      channelId: selectedChannelId.value,
      message: outgoingMessage,
    })
    sendSuccess.value = true
    window.setTimeout(() => {
      emit('close')
    }, 800)
  } catch (error) {
    sendError.value = error instanceof Error ? error.message : 'No se pudo enviar el mensaje a Discord'
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="cancel"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 space-y-4">
        <h2 class="text-base font-semibold text-gray-900">Notificar a Discord</h2>
        <p v-if="props.issueKey" class="text-sm text-gray-600">
          Enviar notificación para
          <span class="font-mono font-medium text-gray-800">{{ props.issueKey }}</span>
        </p>

        <div v-if="isLoading" class="text-sm text-gray-500">Cargando canales y mensaje...</div>

        <div v-else-if="loadError" class="text-sm text-red-600">{{ loadError }}</div>

        <template v-else>
          <div v-if="channels.length === 0" class="text-sm text-red-600">
            No hay canales de Discord configurados.
          </div>

          <div v-else>
            <label class="block text-xs font-medium text-gray-600 mb-1">Canal</label>
            <select
              v-model="selectedChannelId"
              class="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option disabled value="">Selecciona canal</option>
              <option v-for="channel in channels" :key="channel.id" :value="channel.id">
                {{ channel.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Mensaje</label>
            <textarea
              v-model="message"
              rows="10"
              maxlength="2000"
              class="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              :disabled="channels.length === 0"
            />
            <p
              class="text-xs mt-1"
              :class="messageLength > 2000 ? 'text-red-600' : 'text-gray-500'"
            >
              {{ messageLength }} / 2000
            </p>
          </div>

          <p v-if="sendError" class="text-sm text-red-600">{{ sendError }}</p>
          <p v-if="sendSuccess" class="text-sm text-green-600">Mensaje enviado correctamente.</p>
        </template>

        <div class="flex gap-2 justify-end">
          <button
            class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors"
            @click="cancel"
          >
            Cancelar
          </button>
          <button
            class="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
            :disabled="!canSend"
            @click="send"
          >
            {{ isSending ? 'Enviando...' : 'Enviar' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

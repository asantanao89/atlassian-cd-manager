<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useEscapeToClose } from '../composables/useEscapeToClose'
import { jiraApi } from '../api/jiraApi'
import type { CdtTicketStory } from '../types/jira'
import { issueStatusBadgeClass } from '../utils/issueStatus'

const props = defineProps<{
  story: CdtTicketStory
  jiraBaseUrl: string
}>()

const emit = defineEmits<{
  close: []
}>()

useEscapeToClose(() => emit('close'))

const {
  data: details,
  isLoading,
  error,
} = useQuery({
  queryKey: ['cdt-ticket-story-details', props.story.key],
  queryFn: () => jiraApi.getCdtTicketStory(props.story.key),
  retry: 1,
})

const errorMessage = computed(() => {
  if (!error.value) return null
  return error.value instanceof Error ? error.value.message : 'Error al cargar el detalle'
})

const ticketKeys = computed(() => {
  const fromDetails = details.value?.ticketKeys ?? []
  const merged = [...new Set([...props.story.ticketKeys, ...fromDetails])]
  return merged
})

function issueBrowseUrl(issueKey: string): string {
  if (!props.jiraBaseUrl) return '#'
  return `${props.jiraBaseUrl}/browse/${encodeURIComponent(issueKey)}`
}

function display(value: string | undefined): string {
  return value?.trim() ? value : '—'
}

function formatWork(timeSpent: string, originalEstimate: string): string {
  const spent = timeSpent.trim()
  const estimate = originalEstimate.trim()
  if (spent && estimate) return `${spent} / ${estimate}`
  return spent || estimate || '—'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="emit('close')"
    >
      <div
        class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-story-details-title"
      >
        <div class="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-3 shrink-0">
          <h2 id="ticket-story-details-title" class="text-base font-semibold text-gray-900">
            Details
          </h2>
          <button
            type="button"
            class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
            @click="emit('close')"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div class="px-6 py-4 overflow-y-auto min-h-0">
          <div v-if="isLoading" class="flex items-center justify-center py-10 text-sm text-gray-500">
            Cargando detalle...
          </div>
          <div v-else-if="errorMessage" class="text-sm text-red-600">
            {{ errorMessage }}
          </div>
          <div v-else-if="details" class="space-y-4 text-sm">
            <dl class="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Ticket</dt>
                <dd class="mt-0.5 font-mono font-medium">
                  <template v-if="ticketKeys.length > 0">
                    <span
                      v-for="(ticketKey, index) in ticketKeys"
                      :key="ticketKey"
                    >
                      <a
                        v-if="jiraBaseUrl"
                        class="text-blue-600 hover:text-blue-800 underline"
                        :href="issueBrowseUrl(ticketKey)"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {{ ticketKey }}
                      </a>
                      <span v-else>{{ ticketKey }}</span>
                      <span
                        v-if="index < ticketKeys.length - 1"
                        class="font-sans font-normal text-gray-400"
                      >, </span>
                    </span>
                  </template>
                  <span v-else class="font-sans font-normal text-gray-400">—</span>
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Sprint</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.sprintName) }}</dd>
              </div>
            </dl>

            <div>
              <div class="text-xs font-medium uppercase tracking-wide text-gray-500">Summary</div>
              <p class="mt-0.5 text-gray-800 whitespace-pre-wrap">{{ display(details.summary) }}</p>
            </div>

            <div>
              <div class="text-xs font-medium uppercase tracking-wide text-gray-500">Pull requests</div>
              <ul v-if="details.pullRequests.length > 0" class="mt-1 space-y-1">
                <li
                  v-for="pr in details.pullRequests"
                  :key="pr.id"
                >
                  <a
                    v-if="pr.url"
                    class="text-blue-600 hover:text-blue-800 underline"
                    :href="pr.url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ pr.title }}
                  </a>
                  <span v-else class="text-gray-800">{{ pr.title }}</span>
                  <span v-if="pr.state" class="ml-1 text-xs text-gray-500">{{ pr.state }}</span>
                </li>
              </ul>
              <p v-else class="mt-0.5 text-gray-400">—</p>
            </div>

            <div>
              <div class="text-xs font-medium uppercase tracking-wide text-gray-500">Subtareas</div>
              <div v-if="details.subtasks.length > 0" class="mt-1 overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                      <th class="py-1.5 pr-3 text-left font-medium">Key</th>
                      <th class="py-1.5 pr-3 text-left font-medium">Work</th>
                      <th class="py-1.5 pr-3 text-left font-medium">Assignee</th>
                      <th class="py-1.5 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="subtask in details.subtasks" :key="subtask.key">
                      <td class="py-1.5 pr-3 font-mono font-medium whitespace-nowrap">
                        <a
                          v-if="jiraBaseUrl"
                          class="text-blue-600 hover:text-blue-800 underline"
                          :href="issueBrowseUrl(subtask.key)"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {{ subtask.key }}
                        </a>
                        <span v-else>{{ subtask.key }}</span>
                      </td>
                      <td class="py-1.5 pr-3 text-gray-800 whitespace-nowrap">
                        {{ formatWork(subtask.timeSpent, subtask.originalEstimate) }}
                      </td>
                      <td class="py-1.5 pr-3 text-gray-800 whitespace-nowrap">
                        {{ display(subtask.assigneeName) }}
                      </td>
                      <td class="py-1.5 whitespace-nowrap">
                        <span
                          v-if="subtask.statusName"
                          class="text-xs px-1.5 py-0.5 rounded font-medium"
                          :class="issueStatusBadgeClass(subtask.statusName)"
                        >
                          {{ subtask.statusName }}
                        </span>
                        <span v-else class="text-gray-400">—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="mt-0.5 text-gray-400">—</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

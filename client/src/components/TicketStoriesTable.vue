<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import type { CdtTicketStory } from '../types/jira'
import { issueStatusBadgeClass } from '../utils/issueStatus'
import { labelTagClass } from '../utils/labelTag'
import TicketStoryDetailsDialog from './TicketStoryDetailsDialog.vue'

const props = defineProps<{
  stories: CdtTicketStory[]
  isLoading: boolean
  error: string | null
}>()

const { data: connectionInfo } = useQuery({
  queryKey: ['jira-connection-info'],
  queryFn: () => jiraApi.getConnectionInfo(),
  retry: false,
})

const jiraBaseUrl = computed(() => connectionInfo.value?.jiraBaseUrl?.replace(/\/$/, '') ?? '')
const selectedStory = ref<CdtTicketStory | null>(null)

function issueBrowseUrl(issueKey: string): string {
  if (!jiraBaseUrl.value) return '#'
  return `${jiraBaseUrl.value}/browse/${encodeURIComponent(issueKey)}`
}

function openDetails(story: CdtTicketStory): void {
  selectedStory.value = story
}

function closeDetails(): void {
  selectedStory.value = null
}
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
    <div v-if="props.isLoading" class="flex items-center justify-center py-10 text-gray-500 text-sm">
      Cargando historias enlazadas...
    </div>

    <div v-else-if="props.error" class="p-4 text-red-600 bg-red-50 text-sm">
      <strong>Error:</strong> {{ props.error }}
    </div>

    <div
      v-else-if="props.stories.length === 0"
      class="flex items-center justify-center py-10 text-gray-400 text-sm"
    >
      No hay historias enlazadas a tickets abiertos.
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <th class="px-3 py-2 text-left font-medium">Key</th>
            <th class="w-[600px] min-w-[600px] max-w-[600px] px-3 py-2 text-left font-medium">Summary</th>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-left font-medium">Sprint</th>
            <th class="px-3 py-2 text-left font-medium">Componentes</th>
            <th class="px-3 py-2 text-left font-medium">Details</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="story in props.stories"
            :key="story.key"
            class="hover:bg-blue-50 transition-colors"
          >
            <td class="px-3 py-2 font-mono font-medium whitespace-nowrap">
              <a
                v-if="jiraBaseUrl"
                class="text-blue-600 hover:text-blue-800 underline"
                :href="issueBrowseUrl(story.key)"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ story.key }}
              </a>
              <span v-else>{{ story.key }}</span>
            </td>
            <td class="w-[600px] min-w-[600px] max-w-[600px] px-3 py-2 text-gray-800 whitespace-normal break-words">
              {{ story.summary || '—' }}
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              <span
                v-if="story.statusName"
                class="text-xs px-1.5 py-0.5 rounded font-medium"
                :class="issueStatusBadgeClass(story.statusName)"
              >
                {{ story.statusName }}
              </span>
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-3 py-2 text-gray-800 whitespace-nowrap">
              {{ story.sprintName || '—' }}
            </td>
            <td class="px-3 py-2">
              <div v-if="(story.components ?? []).length > 0" class="flex flex-wrap gap-1">
                <span
                  v-for="component in story.components"
                  :key="component"
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="labelTagClass(component)"
                >
                  {{ component }}
                </span>
              </div>
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              <button
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Ver details"
                aria-label="Ver details"
                @click="openDetails(story)"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
                  <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                  <path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clip-rule="evenodd" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <TicketStoryDetailsDialog
    v-if="selectedStory"
    :story="selectedStory"
    :jira-base-url="jiraBaseUrl"
    @close="closeDetails"
  />
</template>

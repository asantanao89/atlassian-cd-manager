<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import type { PendingProductionStory } from '../types/jira'
import { issueStatusBadgeClass } from '../utils/issueStatus'
import {
  developmentStateBadgeClass,
  groupPullRequestStates,
} from '../utils/developmentStatus'
import IssueStatusDropdown from './IssueStatusDropdown.vue'
import PullRequestsDialog from './PullRequestsDialog.vue'
import WorkTypeIcon from './WorkTypeIcon.vue'

const props = defineProps<{
  stories: PendingProductionStory[]
  isLoading: boolean
  error: string | null
}>()

const queryClient = useQueryClient()
const selectedStory = ref<PendingProductionStory | null>(null)

const { data: connectionInfo } = useQuery({
  queryKey: ['jira-connection-info'],
  queryFn: () => jiraApi.getConnectionInfo(),
  retry: false,
})

const jiraBaseUrl = computed(() => connectionInfo.value?.jiraBaseUrl?.replace(/\/$/, '') ?? '')

function issueBrowseUrl(issueKey: string): string {
  if (!jiraBaseUrl.value) return '#'
  return `${jiraBaseUrl.value}/browse/${encodeURIComponent(issueKey)}`
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function hasDevelopment(story: PendingProductionStory): boolean {
  return story.pullRequests.length > 0 || story.branchCount > 0 || story.commitCount > 0
}

function openPullRequests(story: PendingProductionStory): void {
  selectedStory.value = story
}

function closePullRequests(): void {
  selectedStory.value = null
}

function normalizeStatusName(statusName: string): string {
  return statusName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

function onStatusChanged(payload: { issueKey: string; newStatusName: string }): void {
  queryClient.setQueryData<{ stories: PendingProductionStory[] }>(
    ['pending-production-stories'],
    (old) => {
      if (!old) return old
      const keep = normalizeStatusName(payload.newStatusName) === 'listo produccion'
      return {
        ...old,
        stories: old.stories.flatMap((story) => {
          if (story.key !== payload.issueKey) return [story]
          if (!keep) return []
          return [{ ...story, statusName: payload.newStatusName }]
        }),
      }
    },
  )
}

function parentChipColors(story: PendingProductionStory): { bg: string; fg: string; swatch: string } {
  const color = (story.parentStatusColorName ?? '').toLowerCase()
  const category = (story.parentStatusCategoryKey ?? '').toLowerCase()
  const status = normalizeStatusName(story.parentStatusName ?? '')
  if (
    color.includes('green')
    || category === 'done'
    || status.includes('produccion')
    || status.includes('listo')
    || status.includes('hecho')
    || status.includes('done')
  ) {
    return { bg: '#E3FCEF', fg: '#006644', swatch: '#36B37E' }
  }
  if (color.includes('yellow') || category === 'indeterminate') {
    return { bg: '#FFFAE6', fg: '#172B4D', swatch: '#FFAB00' }
  }
  if (color.includes('red') || status.includes('block') || status.includes('imped')) {
    return { bg: '#FFEBE6', fg: '#BF2600', swatch: '#FF5630' }
  }
  if (color.includes('purple') || status.includes('review') || status.includes('qa')) {
    return { bg: '#EAE6FF', fg: '#403294', swatch: '#6554C0' }
  }
  if (
    color.includes('blue')
    || category === 'new'
    || status.includes('desarrollo')
    || status.includes('progreso')
    || status.includes('curso')
  ) {
    return { bg: '#DEEBFF', fg: '#0747A6', swatch: '#4C9AFF' }
  }
  if (status.includes('pend') || status.includes('backlog') || status.includes('por hacer')) {
    return { bg: '#FFFAE6', fg: '#172B4D', swatch: '#FFAB00' }
  }
  return { bg: '#F4F5F7', fg: '#172B4D', swatch: '#6B778C' }
}
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
    <div v-if="props.isLoading" class="flex items-center justify-center py-10 text-gray-500 text-sm">
      Cargando historias...
    </div>

    <div v-else-if="props.error" class="p-4 text-red-600 bg-red-50 text-sm">
      <strong>Error:</strong> {{ props.error }}
    </div>

    <div
      v-else-if="props.stories.length === 0"
      class="flex items-center justify-center py-10 text-gray-400 text-sm"
    >
      No hay historias en Listo Producción.
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <th class="px-3 py-2 text-left font-medium">Key</th>
            <th class="w-[500px] min-w-[500px] max-w-[600px] px-3 py-2 text-left font-medium">Name</th>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-left font-medium">Parent</th>
            <th class="px-3 py-2 text-left font-medium">Development</th>
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
            <td class="w-[500px] min-w-[500px] max-w-[600px] px-3 py-2 text-gray-800 whitespace-normal break-words">
              {{ story.summary || '—' }}
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              <IssueStatusDropdown
                v-if="story.statusName"
                :issue-key="story.key"
                :status-name="story.statusName"
                @status-changed="onStatusChanged"
              />
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-3 py-2">
              <component
                :is="jiraBaseUrl ? 'a' : 'span'"
                v-if="story.parentKey"
                class="inline-flex max-w-[22rem] items-center gap-1.5 rounded-md border px-0.5 py-0.5 text-xs font-medium"
                :class="issueStatusBadgeClass(story.parentStatusName ?? '')"
                :style="{
                  backgroundColor: parentChipColors(story).bg,
                  borderColor: parentChipColors(story).swatch,
                  color: parentChipColors(story).fg,
                }"
                v-bind="
                  jiraBaseUrl
                    ? {
                        href: issueBrowseUrl(story.parentKey),
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      }
                    : {}
                "
                :title="[story.parentKey, story.parentSummary].filter(Boolean).join(' ')"
              >
                <WorkTypeIcon :name="story.parentIssueType || 'Epica'" size="sm" />
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  :style="{ backgroundColor: parentChipColors(story).swatch }"
                  :title="story.parentStatusName ?? undefined"
                />
                <span class="min-w-0 inline-flex flex-wrap gap-0.5">
                  <span class="block font-mono text-xs">{{ story.parentKey }}</span>
                  <span v-if="story.parentSummary" class="block break-words text-xs">
                    {{ story.parentSummary }}
                  </span>
                </span>
              </component>
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-3 py-2">
              <button
                v-if="hasDevelopment(story)"
                type="button"
                class="flex flex-col items-start gap-1 text-left"
                @click="openPullRequests(story)"
              >
                <span
                  v-for="group in groupPullRequestStates(story.pullRequests)"
                  :key="group.state"
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="developmentStateBadgeClass(group.state)"
                >
                  {{ group.count }} {{ group.label }}
                </span>
                <span v-if="story.branchCount > 0" class="text-xs text-gray-500">
                  {{ countLabel(story.branchCount, 'branch', 'branches') }}
                </span>
                <span v-if="story.commitCount > 0" class="text-xs text-gray-500">
                  {{ countLabel(story.commitCount, 'commit', 'commits') }}
                </span>
              </button>
              <span v-else class="text-gray-400">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PullRequestsDialog
      v-if="selectedStory"
      :issue-key="selectedStory.key"
      :pull-requests="selectedStory.pullRequests"
      @close="closePullRequests"
    />
  </div>
</template>

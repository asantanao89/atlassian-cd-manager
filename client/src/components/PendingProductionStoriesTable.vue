<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import type { IssueDevelopment, PendingProductionStory } from '../types/jira'
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
const developmentByKey = ref<Record<string, IssueDevelopment>>({})
const revealedDevelopmentKeys = ref<Record<string, true>>({})
const developmentLoadingKey = ref<string | null>(null)
const developmentError = ref<string | null>(null)

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

function storyDevelopment(story: PendingProductionStory): IssueDevelopment | null {
  return developmentByKey.value[story.key] ?? null
}

function loadedDevelopment(story: PendingProductionStory): IssueDevelopment | null {
  if (!revealedDevelopmentKeys.value[story.key]) return null
  return storyDevelopment(story)
}

function revealDevelopment(issueKey: string): void {
  if (!developmentByKey.value[issueKey]) return
  revealedDevelopmentKeys.value = { ...revealedDevelopmentKeys.value, [issueKey]: true }
}

function hasDevelopment(development: IssueDevelopment): boolean {
  return development.pullRequests.length > 0 || development.branchCount > 0 || development.commitCount > 0
}

async function openPullRequests(story: PendingProductionStory): Promise<void> {
  selectedStory.value = story
  developmentError.value = null
  if (developmentByKey.value[story.key]) return
  developmentLoadingKey.value = story.key
  try {
    const development = await jiraApi.getIssueDevelopment(story.key)
    developmentByKey.value = { ...developmentByKey.value, [story.key]: development }
    if (selectedStory.value?.key !== story.key) revealDevelopment(story.key)
  } catch (error) {
    developmentError.value = error instanceof Error ? error.message : 'No se pudo cargar el desarrollo'
  } finally {
    if (developmentLoadingKey.value === story.key) developmentLoadingKey.value = null
  }
}

function closePullRequests(): void {
  if (selectedStory.value) revealDevelopment(selectedStory.value.key)
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

const expandedParents = ref<Record<string, true>>({})

type StoryRow =
  | { type: 'story'; story: PendingProductionStory; groupSize: number; first: boolean }
  | { type: 'collapsed'; story: PendingProductionStory; count: number }

const rows = computed<StoryRow[]>(() => {
  const result: StoryRow[] = []
  let index = 0
  while (index < props.stories.length) {
    const story = props.stories[index]
    const parentKey = story.parentKey?.trim() ?? ''
    if (!parentKey) {
      result.push({ type: 'story', story, groupSize: 1, first: false })
      index += 1
      continue
    }
    let end = index + 1
    while (end < props.stories.length && (props.stories[end].parentKey?.trim() ?? '') === parentKey) end += 1
    const count = end - index
    if (count > 1 && !expandedParents.value[parentKey]) {
      result.push({ type: 'collapsed', story, count })
    } else {
      for (let cursor = index; cursor < end; cursor += 1) {
        result.push({ type: 'story', story: props.stories[cursor], groupSize: count, first: cursor === index })
      }
    }
    index = end
  }
  return result
})

function toggleParent(parentKey: string): void {
  const next = { ...expandedParents.value }
  if (next[parentKey]) delete next[parentKey]
  else next[parentKey] = true
  expandedParents.value = next
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
            v-for="row in rows"
            :key="row.type === 'collapsed' ? `collapsed-${row.story.parentKey}` : row.story.key"
            class="hover:bg-blue-50 transition-colors"
          >
            <template v-if="row.type === 'collapsed' && row.story.parentKey">
              <td colspan="5" class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
                    :aria-label="`Mostrar historias de ${row.story.parentKey}`"
                    @click="toggleParent(row.story.parentKey)"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
                      <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" />
                    </svg>
                  </button>
                  <component
                    :is="jiraBaseUrl ? 'a' : 'span'"
                    class="inline-flex max-w-[22rem] items-center gap-1.5 rounded-md border px-0.5 py-0.5 text-xs font-medium"
                    :style="{
                      backgroundColor: parentChipColors(row.story).bg,
                      borderColor: parentChipColors(row.story).swatch,
                      color: parentChipColors(row.story).fg,
                    }"
                    v-bind="jiraBaseUrl ? { href: issueBrowseUrl(row.story.parentKey), target: '_blank', rel: 'noopener noreferrer' } : {}"
                  >
                    <WorkTypeIcon :name="row.story.parentIssueType || 'Epica'" size="sm" />
                    <span class="font-mono">{{ row.story.parentKey }}</span>
                    <span v-if="row.story.parentSummary">{{ row.story.parentSummary }}</span>
                  </component>
                  <span class="text-xs text-gray-500">{{ row.count }} historias</span>
                </div>
              </td>
            </template>
            <template v-else-if="row.type === 'story'">
            <td class="px-3 py-2 font-mono font-medium whitespace-nowrap">
              <a
                v-if="jiraBaseUrl"
                class="text-blue-600 hover:text-blue-800 underline"
                :href="issueBrowseUrl(row.story.key)"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ row.story.key }}
              </a>
              <span v-else>{{ row.story.key }}</span>
            </td>
            <td class="w-[500px] min-w-[500px] max-w-[600px] px-3 py-2 text-gray-800 whitespace-normal break-words">
              {{ row.story.summary || '—' }}
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              <IssueStatusDropdown
                v-if="row.story.statusName"
                :issue-key="row.story.key"
                :status-name="row.story.statusName"
                @status-changed="onStatusChanged"
              />
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-3 py-2">
              <div class="flex items-center gap-1">
              <button
                v-if="row.first && row.groupSize > 1 && row.story.parentKey"
                type="button"
                class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
                :aria-label="`Ocultar historias de ${row.story.parentKey}`"
                @click="toggleParent(row.story.parentKey)"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
                  <path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                </svg>
              </button>
              <component
                :is="jiraBaseUrl ? 'a' : 'span'"
                v-if="row.story.parentKey"
                class="inline-flex max-w-[22rem] items-center gap-1.5 rounded-md border px-0.5 py-0.5 text-xs font-medium"
                :class="issueStatusBadgeClass(row.story.parentStatusName ?? '')"
                :style="{
                  backgroundColor: parentChipColors(row.story).bg,
                  borderColor: parentChipColors(row.story).swatch,
                  color: parentChipColors(row.story).fg,
                }"
                v-bind="
                  jiraBaseUrl
                    ? {
                        href: issueBrowseUrl(row.story.parentKey),
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      }
                    : {}
                "
                :title="[row.story.parentKey, row.story.parentSummary].filter(Boolean).join(' ')"
              >
                <WorkTypeIcon :name="row.story.parentIssueType || 'Epica'" size="sm" />
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  :style="{ backgroundColor: parentChipColors(row.story).swatch }"
                  :title="row.story.parentStatusName ?? undefined"
                />
                <span class="min-w-0 inline-flex flex-wrap gap-0.5">
                  <span class="block font-mono text-xs">{{ row.story.parentKey }}</span>
                  <span v-if="row.story.parentSummary" class="block break-words text-xs">
                    {{ row.story.parentSummary }}
                  </span>
                </span>
              </component>
              <span v-else class="text-gray-400">—</span>
              </div>
            </td>
            <td class="px-3 py-2">
              <button
                v-if="loadedDevelopment(row.story) && hasDevelopment(loadedDevelopment(row.story)!)"
                type="button"
                class="flex flex-col items-start gap-1 text-left"
                @click="openPullRequests(row.story)"
              >
                <span
                  v-for="group in groupPullRequestStates(loadedDevelopment(row.story)!.pullRequests)"
                  :key="group.state"
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="developmentStateBadgeClass(group.state)"
                >
                  {{ group.count }} {{ group.label }}
                </span>
                <span v-if="loadedDevelopment(row.story)!.branchCount > 0" class="text-xs text-gray-500">
                  {{ countLabel(loadedDevelopment(row.story)!.branchCount, 'branch', 'branches') }}
                </span>
                <span v-if="loadedDevelopment(row.story)!.commitCount > 0" class="text-xs text-gray-500">
                  {{ countLabel(loadedDevelopment(row.story)!.commitCount, 'commit', 'commits') }}
                </span>
              </button>
              <span v-else-if="loadedDevelopment(row.story)" class="text-gray-400">—</span>
              <button
                v-else
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Ver desarrollo"
                aria-label="Ver desarrollo"
                @click="openPullRequests(row.story)"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
                  <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                  <path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clip-rule="evenodd" />
                </svg>
              </button>
            </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <PullRequestsDialog
      v-if="selectedStory"
      :issue-key="selectedStory.key"
      :pull-requests="storyDevelopment(selectedStory)?.pullRequests ?? []"
      :branch-count="storyDevelopment(selectedStory)?.branchCount ?? 0"
      :commit-count="storyDevelopment(selectedStory)?.commitCount ?? 0"
      :is-loading="developmentLoadingKey === selectedStory.key"
      :error="developmentError"
      @close="closePullRequests"
    />
  </div>
</template>

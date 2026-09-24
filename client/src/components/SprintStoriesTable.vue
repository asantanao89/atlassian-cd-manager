<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import type { SprintStory } from '../types/jira'

type SprintAction = NonNullable<SprintStory['actionRequired']>
import { formatCreatedAt } from '../composables/useTicketsTableFilters'
import { formatOpenDuration, openDurationChipClass } from '../utils/formatOpenDuration'
import { issueStatusBadgeClass } from '../utils/issueStatus'
import WorkTypeIcon from './WorkTypeIcon.vue'

const props = defineProps<{
  stories: SprintStory[]
  isLoading: boolean
  error: string | null
}>()

const selectedStatus = ref<string | null>(null)
const actionRequiredOnly = ref(false)

const quickFilterButtonClass =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors'
const quickFilterIdleClass = 'border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
const quickFilterActiveClass = 'border-blue-600 bg-blue-600 text-white'

const STATUS_RANK = [
  'backlog',
  'en desarrollo',
  'aceptacion po',
  'listo produccion',
  'produccion',
]

function normalizeStatus(statusName: string): string {
  return statusName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

function statusRank(statusName: string): number {
  const rank = STATUS_RANK.indexOf(normalizeStatus(statusName))
  return rank === -1 ? STATUS_RANK.length : rank
}

const statusFilters = computed(() => {
  const counts = new Map<string, number>()
  for (const story of props.stories) {
    const name = story.statusName.trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => statusRank(a.name) - statusRank(b.name) || a.name.localeCompare(b.name, 'es'))
})

const activeStatus = computed(() => {
  if (!selectedStatus.value) return null
  return statusFilters.value.some((filter) => filter.name === selectedStatus.value)
    ? selectedStatus.value
    : null
})

const actionRequiredCount = computed(
  () => props.stories.filter((story) => story.actionRequired != null).length,
)

const visibleStories = computed(() => {
  if (actionRequiredOnly.value) {
    return props.stories.filter((story) => story.actionRequired != null)
  }
  if (!activeStatus.value) return props.stories
  return props.stories.filter((story) => story.statusName === activeStatus.value)
})

function toggleStatus(statusName: string): void {
  actionRequiredOnly.value = false
  selectedStatus.value = selectedStatus.value === statusName ? null : statusName
}

function toggleActionRequired(): void {
  selectedStatus.value = null
  actionRequiredOnly.value = !actionRequiredOnly.value
}

function actionBadgeClass(action: SprintAction): string {
  if (action === 'Prepare PO') return 'bg-violet-100 text-violet-800'
  return 'bg-amber-100 text-amber-800'
}

function parentChipColors(story: SprintStory): { bg: string; fg: string; swatch: string } {
  const color = (story.parentStatusColorName ?? '').toLowerCase()
  const category = (story.parentStatusCategoryKey ?? '').toLowerCase()
  const status = normalizeStatus(story.parentStatusName ?? '')
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
      No hay historias en el sprint actual.
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <button
          v-if="actionRequiredCount > 0"
          type="button"
          :class="[quickFilterButtonClass, actionRequiredOnly ? quickFilterActiveClass : quickFilterIdleClass]"
          :aria-pressed="actionRequiredOnly"
          @click="toggleActionRequired"
        >
          Action required
          <span :class="actionRequiredOnly ? 'text-blue-100' : 'text-gray-500'">{{ actionRequiredCount }}</span>
        </button>
        <button
          v-for="filter in statusFilters"
          :key="filter.name"
          type="button"
          :class="[quickFilterButtonClass, activeStatus === filter.name ? quickFilterActiveClass : quickFilterIdleClass]"
          :aria-pressed="activeStatus === filter.name"
          @click="toggleStatus(filter.name)"
        >
          {{ filter.name }}
          <span :class="activeStatus === filter.name ? 'text-blue-100' : 'text-gray-500'">{{ filter.count }}</span>
        </button>
      </div>

      <div
        v-if="visibleStories.length === 0"
        class="flex items-center justify-center py-10 text-gray-400 text-sm"
      >
        Ninguna historia coincide con el filtro.
      </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <th class="px-3 py-2 text-left font-medium">Added</th>
            <th class="px-3 py-2 text-left font-medium">Key</th>
            <th class="w-[500px] min-w-[500px] max-w-[600px] px-3 py-2 text-left font-medium">Summary</th>
            <th class="px-3 py-2 text-left font-medium">Status</th>
            <th class="px-3 py-2 text-left font-medium">Parent</th>
            <th class="px-3 py-2 text-left font-medium">Action required</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="story in visibleStories"
            :key="story.key"
            class="hover:bg-blue-50 transition-colors"
          >
            <td
              class="px-3 py-2 whitespace-nowrap"
              :title="formatCreatedAt(story.addedAt) || undefined"
            >
              <span
                v-if="openDurationChipClass(story.addedAt)"
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                :class="openDurationChipClass(story.addedAt)"
              >
                {{ formatOpenDuration(story.addedAt) }}
              </span>
              <span v-else class="text-gray-400">—</span>
            </td>
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
              <span
                v-if="story.statusName"
                class="text-xs px-1.5 py-0.5 rounded font-medium"
                :class="issueStatusBadgeClass(story.statusName)"
              >
                {{ story.statusName }}
              </span>
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
            <td class="px-3 py-2 whitespace-nowrap">
              <span
                v-if="story.actionRequired"
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                :class="actionBadgeClass(story.actionRequired)"
              >
                {{ story.actionRequired }}
              </span>
              <span v-else class="text-gray-400">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </template>
  </div>
</template>

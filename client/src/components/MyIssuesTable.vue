<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import { usePendingChangesStore } from '../stores/pendingChanges.store'
import { parseJiraDurationToSeconds } from '../utils/jiraDuration'
import type { JiraIssueSummary } from '../types/jira'
import type { PendingChange } from '../types/pendingChange'

const props = defineProps<{
  issues: JiraIssueSummary[]
  isLoading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  viewWorklogs: [issue: JiraIssueSummary]
  createWorklog: [issue: JiraIssueSummary]
}>()

const { data: connectionInfo } = useQuery({
  queryKey: ['jira-connection-info'],
  queryFn: () => jiraApi.getConnectionInfo(),
  retry: false,
})

const jiraBaseUrl = computed(() => connectionInfo.value?.jiraBaseUrl?.replace(/\/$/, '') ?? '')
const copiedIssueKey = ref<string | null>(null)

const pendingChangesStore = usePendingChangesStore()
const { changes } = storeToRefs(pendingChangesStore)

function issueBrowseUrl(issueKey: string): string {
  if (!jiraBaseUrl.value) return '#'
  return `${jiraBaseUrl.value}/browse/${encodeURIComponent(issueKey)}`
}

async function copyIssueKey(issueKey: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(issueKey)
    copiedIssueKey.value = issueKey
    window.setTimeout(() => {
      if (copiedIssueKey.value === issueKey) copiedIssueKey.value = null
    }, 1500)
  } catch {
    copiedIssueKey.value = null
  }
}

function readWorklogSeconds(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>

  if (typeof record.timeSpentSeconds === 'number') return record.timeSpentSeconds
  if (typeof record.timeSpent === 'string') {
    try {
      return parseJiraDurationToSeconds(record.timeSpent)
    } catch {
      return null
    }
  }
  return null
}

function getPendingHoursForIssue(issueKey: string): number {
  const activeChanges = changes.value.filter(
    (change: PendingChange) => change.status === 'draft' || change.status === 'running',
  )

  let totalSeconds = 0

  for (const change of activeChanges) {
    if (change.issueKey !== issueKey) continue

    if (change.type === 'create-worklog') {
      const seconds = readWorklogSeconds(change.after)
      if (seconds) totalSeconds += seconds
      continue
    }

    if (change.type === 'update-worklog') {
      const oldSeconds = readWorklogSeconds(change.before) ?? 0
      const newSeconds = readWorklogSeconds(change.after) ?? 0
      totalSeconds += newSeconds - oldSeconds
      continue
    }

    if (change.type === 'delete-worklog') {
      const oldSeconds = readWorklogSeconds(change.before) ?? 0
      totalSeconds -= oldSeconds
    }
  }

  return totalSeconds
}

function formatCompactHours(seconds: number): string {
  if (seconds === 0) return '—'
  const sign = seconds > 0 ? '+' : ''
  const hours = Math.abs(seconds) / 3600
  return `${sign}${hours.toFixed(1).replace(/\.0$/, '')}h`
}
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
    <div v-if="props.isLoading" class="flex items-center justify-center py-10 text-gray-500 text-sm">
      Cargando issues...
    </div>

    <div v-else-if="props.error" class="p-4 text-red-600 bg-red-50 text-sm">
      <strong>Error:</strong> {{ props.error }}
    </div>

    <div
      v-else-if="props.issues.length === 0"
      class="flex items-center justify-center py-10 text-gray-400 text-sm"
    >
      No hay issues para mostrar.
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <th class="px-3 py-2 text-left font-medium">KEY</th>
            <th class="px-3 py-2 text-left font-medium">PARENT</th>
            <th class="px-3 py-2 text-left font-medium">TIPO</th>
            <th class="px-3 py-2 text-left font-medium">SUMMARY</th>
            <th class="px-3 py-2 text-left font-medium">ESTADO</th>
            <th class="px-3 py-2 text-left font-medium">DEDICADO</th>
            <th class="px-3 py-2 text-left font-medium">ACCIONES</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="issue in props.issues"
            :key="issue.id"
            class="hover:bg-blue-50 transition-colors"
          >
            <td class="px-3 py-2 font-mono font-medium whitespace-nowrap">
              <div class="flex items-center gap-1">
                <a
                  v-if="jiraBaseUrl"
                  class="text-blue-600 hover:text-blue-800 underline"
                  :href="issueBrowseUrl(issue.key)"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click.stop
                >
                  {{ issue.key }}
                </a>
                <span v-else class="text-blue-600">{{ issue.key }}</span>
                <button
                  type="button"
                  class="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  :class="copiedIssueKey === issue.key ? 'text-green-600' : ''"
                  :title="copiedIssueKey === issue.key ? 'Copiado' : 'Copiar clave'"
                  @click.stop="copyIssueKey(issue.key)"
                >
                  <svg v-if="copiedIssueKey !== issue.key" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M6.5 2.5A2.5 2.5 0 0 0 4 5v8A2.5 2.5 0 0 0 6.5 15.5h6A2.5 2.5 0 0 0 15 13V5a2.5 2.5 0 0 0-2.5-2.5h-6Zm0 1h6A1.5 1.5 0 0 1 14 5v8a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 5 13V5a1.5 1.5 0 0 1 1.5-1.5Z" />
                    <path d="M3.5 6A.5.5 0 0 1 4 6.5v8A2.5 2.5 0 0 0 6.5 17H12a.5.5 0 0 1 0 1H6.5A3.5 3.5 0 0 1 3 14.5v-8a.5.5 0 0 1 .5-.5Z" />
                  </svg>
                  <svg v-else viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-8 8.07a1 1 0 0 1-1.42.007l-3-3.003a1 1 0 1 1 1.414-1.414l2.29 2.291 7.296-7.36a1 1 0 0 1 1.414-.005Z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              <a
                v-if="issue.parentKey && jiraBaseUrl"
                class="text-xs font-mono font-medium text-purple-600 hover:text-purple-800 underline"
                :href="issueBrowseUrl(issue.parentKey)"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
              >
                {{ issue.parentKey }}
              </a>
              <span v-else class="text-xs text-gray-400">—</span>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              <span
                class="text-xs px-1.5 py-0.5 rounded font-medium"
                :class="issue.issueType === 'Story' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'"
              >
                {{ issue.issueType }}
              </span>
            </td>
            <td class="px-3 py-2 max-w-sm">
              <p
                v-if="issue.parentSummary"
                class="text-[11px] text-gray-400 leading-tight summary-clamp-2"
                :title="issue.parentSummary"
              >
                {{ issue.parentSummary }}
              </p>
              <p
                class="text-gray-700 leading-tight summary-clamp-2"
                :title="issue.summary"
              >
                {{ issue.summary }}
              </p>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                {{ issue.statusName }}
              </span>
            </td>
            <td class="px-3 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">
              {{ issue.timetracking.timeSpent ?? '—' }}
              <span
                v-if="getPendingHoursForIssue(issue.key) !== 0"
                class="text-yellow-700 font-medium"
              >
                {{ formatCompactHours(getPendingHoursForIssue(issue.key)) }}
              </span>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              <div class="flex items-center gap-1">
                <button
                  class="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-600 transition-colors"
                  title="Ver worklogs"
                  @click="emit('viewWorklogs', issue)"
                >
                  Worklogs
                </button>
                <button
                  class="text-xs px-2 py-1 rounded border border-blue-300 hover:bg-blue-50 text-blue-600 transition-colors"
                  title="Añadir worklog"
                  @click="emit('createWorklog', issue)"
                >
                  + Log
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.summary-clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
</style>

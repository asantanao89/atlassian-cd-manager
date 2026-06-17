<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import RepoPickerDialog from './RepoPickerDialog.vue'
import DiscordNotifyDialog from './DiscordNotifyDialog.vue'
import IssueStatusDropdown from './IssueStatusDropdown.vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import { usePendingChangesStore } from '../stores/pendingChanges.store'
import { parseJiraDurationToSeconds } from '../utils/jiraDuration'
import type { JiraIssueSummary, JiraOpenPullRequest } from '../types/jira'
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
const copiedCellId = ref<string | null>(null)
const expandedIssueId = ref<string | null>(null)
const parentPullRequestsByKey = ref<Record<string, JiraOpenPullRequest[]>>({})
const parentPullRequestsLoading = ref<Record<string, boolean>>({})
const parentPullRequestsError = ref<Record<string, string | null>>({})

const pendingChangesStore = usePendingChangesStore()
const { changes } = storeToRefs(pendingChangesStore)

const showRepoPicker = ref(false)
const pendingPrSourceKey = ref<string | null>(null)

const showDiscordNotify = ref(false)
const pendingDiscordIssue = ref<{ key: string; summary: string } | null>(null)

function openRepoPicker(sourceKey: string): void {
  pendingPrSourceKey.value = sourceKey
  showRepoPicker.value = true
}

function openDiscordNotify(issueKey: string, issueSummary: string): void {
  pendingDiscordIssue.value = { key: issueKey, summary: issueSummary }
  showDiscordNotify.value = true
}

function issueBrowseUrl(issueKey: string): string {
  if (!jiraBaseUrl.value) return '#'
  return `${jiraBaseUrl.value}/browse/${encodeURIComponent(issueKey)}`
}

async function copyIssueKey(issueKey: string, cellId: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(issueKey)
    copiedCellId.value = cellId
    window.setTimeout(() => {
      if (copiedCellId.value === cellId) copiedCellId.value = null
    }, 1500)
  } catch {
    copiedCellId.value = null
  }
}

async function loadParentPullRequests(parentKey: string): Promise<void> {
  if (parentPullRequestsLoading.value[parentKey]) return
  parentPullRequestsLoading.value[parentKey] = true
  parentPullRequestsError.value[parentKey] = null

  try {
    const result = await jiraApi.getOpenPullRequestsForParent(parentKey)
    parentPullRequestsByKey.value[parentKey] = result.pullRequests
  } catch (error) {
    parentPullRequestsError.value[parentKey] =
      error instanceof Error ? error.message : 'No se pudieron cargar los pull requests'
  } finally {
    parentPullRequestsLoading.value[parentKey] = false
  }
}

function isParentDetailsOpen(issue: JiraIssueSummary): boolean {
  return expandedIssueId.value === issue.id
}

async function toggleParentDetails(issue: JiraIssueSummary): Promise<void> {
  if (!issue.parentKey) return

  if (expandedIssueId.value === issue.id) {
    expandedIssueId.value = null
    return
  }

  expandedIssueId.value = issue.id
  if (!Object.prototype.hasOwnProperty.call(parentPullRequestsByKey.value, issue.parentKey)) {
    await loadParentPullRequests(issue.parentKey)
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

function onStatusChanged(payload: { issueKey: string; newStatusName: string }): void {
  const issue = props.issues.find((item) => item.key === payload.issueKey)
  if (!issue) return
  issue.statusName = payload.newStatusName
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
          <template v-for="issue in props.issues" :key="issue.id">
            <tr class="hover:bg-blue-50 transition-colors">
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
                  :class="copiedCellId === `${issue.id}-key` ? 'text-green-600' : ''"
                  :title="copiedCellId === `${issue.id}-key` ? 'Copiado' : 'Copiar clave'"
                  @click.stop="copyIssueKey(issue.key, `${issue.id}-key`)"
                >
                  <svg v-if="copiedCellId !== `${issue.id}-key`" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M6.5 2.5A2.5 2.5 0 0 0 4 5v8A2.5 2.5 0 0 0 6.5 15.5h6A2.5 2.5 0 0 0 15 13V5a2.5 2.5 0 0 0-2.5-2.5h-6Zm0 1h6A1.5 1.5 0 0 1 14 5v8a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 5 13V5a1.5 1.5 0 0 1 1.5-1.5Z" />
                    <path d="M3.5 6A.5.5 0 0 1 4 6.5v8A2.5 2.5 0 0 0 6.5 17H12a.5.5 0 0 1 0 1H6.5A3.5 3.5 0 0 1 3 14.5v-8a.5.5 0 0 1 .5-.5Z" />
                  </svg>
                  <svg v-else viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-8 8.07a1 1 0 0 1-1.42.007l-3-3.003a1 1 0 1 1 1.414-1.414l2.29 2.291 7.296-7.36a1 1 0 0 1 1.414-.005Z" clip-rule="evenodd" />
                  </svg>
                </button>
                <router-link
                  :to="{ name: 'branch', query: { issue: issue.key } }"
                  class="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="Crear rama"
                  @click.stop
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25ZM11 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-7 1a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
                  </svg>
                </router-link>
                <button
                  type="button"
                  class="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="Crear pull request"
                  @click.stop="openRepoPicker(issue.key)"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600"
                  title="Notificar a Discord"
                  @click.stop="openDiscordNotify(issue.key, issue.summary)"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8.5 8.5 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.02.015C.356 6.024-.213 9.047.066 12.032a.05.05 0 0 0 .019.024 13.2 13.2 0 0 0 3.993 2.01.05.05 0 0 0 .056-.019 9.3 9.3 0 0 0 .816-1.329.05.05 0 0 0-.027-.07 8.7 8.7 0 0 1-1.248-.595.05.05 0 0 1-.005-.085 6.5 6.5 0 0 0 .248-.194.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.006 6.5 6.5 0 0 0 .247.195.05.05 0 0 1-.004.085 8.6 8.6 0 0 1-1.249.594.05.05 0 0 0-.027.07 9.9 9.9 0 0 0 .817 1.328.05.05 0 0 0 .055.02 13.2 13.2 0 0 0 4.001-2.01.05.05 0 0 0 .019-.023c.332-3.451-.568-6.424-2.365-9.127a.03.03 0 0 0-.02-.015ZM5.34 10.97c-.79 0-1.438-.73-1.438-1.623 0-.895.637-1.628 1.438-1.628.807 0 1.45.74 1.438 1.628 0 .894-.637 1.623-1.438 1.623Zm5.32 0c-.79 0-1.438-.73-1.438-1.623 0-.895.637-1.628 1.438-1.628.807 0 1.45.74 1.438 1.628 0 .894-.63 1.623-1.438 1.623Z" />
                  </svg>
                </button>
              </div>
            </td>
            <td class="px-3 py-2 font-mono font-medium whitespace-nowrap">
              <div v-if="issue.parentKey" class="flex items-center gap-1">
                <a
                  v-if="jiraBaseUrl"
                  class="text-blue-600 hover:text-blue-800 underline"
                  :href="issueBrowseUrl(issue.parentKey)"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click.stop
                >
                  {{ issue.parentKey }}
                </a>
                <span v-else class="text-blue-600">{{ issue.parentKey }}</span>
                <button
                  type="button"
                  class="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  :class="copiedCellId === `${issue.id}-parent` ? 'text-green-600' : ''"
                  :title="copiedCellId === `${issue.id}-parent` ? 'Copiado' : 'Copiar clave'"
                  @click.stop="copyIssueKey(issue.parentKey, `${issue.id}-parent`)"
                >
                  <svg v-if="copiedCellId !== `${issue.id}-parent`" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M6.5 2.5A2.5 2.5 0 0 0 4 5v8A2.5 2.5 0 0 0 6.5 15.5h6A2.5 2.5 0 0 0 15 13V5a2.5 2.5 0 0 0-2.5-2.5h-6Zm0 1h6A1.5 1.5 0 0 1 14 5v8a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 5 13V5a1.5 1.5 0 0 1 1.5-1.5Z" />
                    <path d="M3.5 6A.5.5 0 0 1 4 6.5v8A2.5 2.5 0 0 0 6.5 17H12a.5.5 0 0 1 0 1H6.5A3.5 3.5 0 0 1 3 14.5v-8a.5.5 0 0 1 .5-.5Z" />
                  </svg>
                  <svg v-else viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-8 8.07a1 1 0 0 1-1.42.007l-3-3.003a1 1 0 1 1 1.414-1.414l2.29 2.291 7.296-7.36a1 1 0 0 1 1.414-.005Z" clip-rule="evenodd" />
                  </svg>
                </button>
                <router-link
                  :to="{ name: 'branch', query: { issue: issue.parentKey } }"
                  class="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="Crear rama"
                  @click.stop
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25ZM11 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-7 1a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
                  </svg>
                </router-link>
                <button
                  type="button"
                  class="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="Crear pull request"
                  @click.stop="openRepoPicker(issue.parentKey!)"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600"
                  title="Notificar a Discord"
                  @click.stop="openDiscordNotify(issue.parentKey!, issue.parentSummary ?? issue.parentKey!)"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8.5 8.5 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.02.015C.356 6.024-.213 9.047.066 12.032a.05.05 0 0 0 .019.024 13.2 13.2 0 0 0 3.993 2.01.05.05 0 0 0 .056-.019 9.3 9.3 0 0 0 .816-1.329.05.05 0 0 0-.027-.07 8.7 8.7 0 0 1-1.248-.595.05.05 0 0 1-.005-.085 6.5 6.5 0 0 0 .248-.194.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.006 6.5 6.5 0 0 0 .247.195.05.05 0 0 1-.004.085 8.6 8.6 0 0 1-1.249.594.05.05 0 0 0-.027.07 9.9 9.9 0 0 0 .817 1.328.05.05 0 0 0 .055.02 13.2 13.2 0 0 0 4.001-2.01.05.05 0 0 0 .019-.023c.332-3.451-.568-6.424-2.365-9.127a.03.03 0 0 0-.02-.015ZM5.34 10.97c-.79 0-1.438-.73-1.438-1.623 0-.895.637-1.628 1.438-1.628.807 0 1.45.74 1.438 1.628 0 .894-.637 1.623-1.438 1.623Zm5.32 0c-.79 0-1.438-.73-1.438-1.623 0-.895.637-1.628 1.438-1.628.807 0 1.45.74 1.438 1.628 0 .894-.63 1.623-1.438 1.623Z" />
                  </svg>
                </button>
              </div>
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
              <IssueStatusDropdown
                :issue-key="issue.key"
                :status-name="issue.statusName"
                @status-changed="onStatusChanged"
              />
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
                <button
                  class="text-xs px-2 py-1 text-gray-500 hover:text-gray-700 disabled:opacity-40"
                  :title="issue.parentKey ? 'Ver PRs abiertos del parent' : 'Sin parent'"
                  :disabled="!issue.parentKey"
                  @click="toggleParentDetails(issue)"
                >
                  {{ isParentDetailsOpen(issue) ? '▼' : '▶' }}
                </button>
              </div>
            </td>
            </tr>
            <tr v-if="issue.parentKey && isParentDetailsOpen(issue)" class="bg-purple-50/40">
              <td colspan="7" class="px-3 py-3">
                <div v-if="parentPullRequestsLoading[issue.parentKey]" class="text-xs text-gray-500">
                  Cargando pull requests abiertos de {{ issue.parentKey }}...
                </div>
                <div
                  v-else-if="parentPullRequestsError[issue.parentKey]"
                  class="text-xs text-red-600"
                >
                  {{ parentPullRequestsError[issue.parentKey] }}
                </div>
                <div
                  v-else-if="(parentPullRequestsByKey[issue.parentKey] ?? []).length === 0"
                  class="text-xs text-gray-500"
                >
                  No hay pull requests abiertos en el parent {{ issue.parentKey }}.
                </div>
                <div v-else class="space-y-1.5">
                  <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Pull requests abiertos en {{ issue.parentKey }}
                  </p>
                  <ul class="space-y-1">
                    <li
                      v-for="pr in parentPullRequestsByKey[issue.parentKey]"
                      :key="pr.id"
                      class="text-xs text-gray-700 flex flex-wrap items-center gap-2"
                    >
                      <a
                        v-if="pr.url"
                        :href="pr.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-600 hover:text-blue-800 underline"
                      >
                        {{ pr.title }}
                      </a>
                      <span v-else>{{ pr.title }}</span>
                      <span v-if="pr.repository" class="text-gray-500">({{ pr.repository }})</span>
                      <span v-if="pr.sourceBranch && pr.targetBranch" class="text-gray-500">
                        {{ pr.sourceBranch }} -> {{ pr.targetBranch }}
                      </span>
                      <span v-else-if="pr.sourceBranch" class="text-gray-500">{{ pr.sourceBranch }}</span>
                      <span
                        v-if="pr.state"
                        class="px-1.5 py-0.5 rounded border border-blue-300 text-blue-700 font-semibold"
                      >
                        {{ pr.state }}
                      </span>
                    </li>
                  </ul>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>

  <RepoPickerDialog
    :show="showRepoPicker"
    :source-key="pendingPrSourceKey"
    @close="showRepoPicker = false"
  />

  <DiscordNotifyDialog
    :show="showDiscordNotify"
    :issue-key="pendingDiscordIssue?.key ?? null"
    :issue-summary="pendingDiscordIssue?.summary ?? null"
    @close="showDiscordNotify = false"
  />
</template>

<style scoped>
.summary-clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
</style>

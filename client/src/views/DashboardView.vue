<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { JiraIssueSummary, JiraWorklog } from '../types/jira'
import { jiraApi } from '../api/jiraApi'
import { parseJiraDurationToSeconds } from '../utils/jiraDuration'
import { usePendingChangesStore } from '../stores/pendingChanges.store'
import type { PendingChange } from '../types/pendingChange'
import ConnectionStatus from '../components/ConnectionStatus.vue'
import TrackingSummaryCards from '../components/TrackingSummaryCards.vue'
import DailyHoursChartBlock from '../components/DailyHoursChartBlock.vue'
import MyOpenIssuesTable from '../components/MyOpenIssuesTable.vue'
import MyIssuesTable from '../components/MyIssuesTable.vue'
import WorklogList from '../components/WorklogList.vue'
import WorklogEditor from '../components/WorklogEditor.vue'
import VacationDaysSection from '../components/VacationDaysSection.vue'

type PanelMode = 'worklogs' | 'create-worklog' | 'edit-worklog' | null

const queryClient = useQueryClient()
const isMonthSectionOpen = ref(false)

const {
  data: myOpenIssues,
  isLoading: isLoadingMyOpenIssues,
  error: myOpenIssuesError,
  refetch: refetchMyOpenIssues,
} = useQuery({
  queryKey: ['dashboard-my-open-issues'],
  queryFn: async () => {
    const result = await jiraApi.searchIssues({
      jql: 'assignee = currentUser() AND statusCategory != Done AND project != CDT ORDER BY updated DESC',
      maxResults: 50,
    })
    return result.issues
  },
  retry: 1,
})

const myOpenIssuesErrorMessage = computed(() => {
  if (!myOpenIssuesError.value) return null
  return myOpenIssuesError.value instanceof Error
    ? myOpenIssuesError.value.message
    : 'Error al cargar mis issues abiertas'
})

const {
  data: myMonthIssues,
  isLoading: isLoadingMyMonthIssues,
  error: myMonthIssuesError,
  refetch: refetchMyMonthIssues,
} = useQuery({
  queryKey: ['dashboard-my-month-issues'],
  queryFn: async () => {
    const result = await jiraApi.searchIssues({
      jql: 'assignee = currentUser() AND updated >= startOfMonth() AND project != CDT ORDER BY updated DESC',
      maxResults: 100,
    })
    return result.issues
  },
  retry: 1,
  enabled: computed(() => isMonthSectionOpen.value),
})

const myMonthIssuesErrorMessage = computed(() => {
  if (!myMonthIssuesError.value) return null
  return myMonthIssuesError.value instanceof Error
    ? myMonthIssuesError.value.message
    : 'Error al cargar issues del mes'
})

const selectedIssue = ref<JiraIssueSummary | null>(null)
const panelMode = ref<PanelMode>(null)
const editingWorklog = ref<JiraWorklog | null>(null)
const quickLogStartedAt = ref<string | null>(null)
const isTaskPickerOpen = ref(false)
const selectedQuickLogIssueKey = ref('')
const quickLogIssueSearch = ref('')
const isQuickLogDropdownOpen = ref(false)
const isPendingDayPopupOpen = ref(false)
const selectedPendingDayIso = ref<string | null>(null)
const isOverbookedDayPopupOpen = ref(false)
const selectedOverbookedDayIso = ref<string | null>(null)
const confirmDeleteWorklogId = ref<string | null>(null)
const pendingChangesStore = usePendingChangesStore()
const { changes } = storeToRefs(pendingChangesStore)

const { data: currentUser } = useQuery({
  queryKey: ['jira-me'],
  queryFn: () => jiraApi.getMe(),
  retry: false,
})

const currentUserDisplayName = computed(() => currentUser.value?.displayName?.trim().toLowerCase() ?? '')

const { data: monthlyIssuesWithWorklogs } = useQuery({
  queryKey: ['dashboard-monthly-issues-with-worklogs', currentUserDisplayName],
  queryFn: async () => {
    const result = await jiraApi.searchIssuesWithWorklogs({
      jql: 'worklogAuthor = currentUser() AND worklogDate >= startOfMonth() ORDER BY updated DESC',
      maxResults: 100,
    })

    return result.issues
      .map((issue) => ({
        ...issue,
        worklogs: issue.worklogs.filter(
          (worklog) => worklog.authorDisplayName.trim().toLowerCase() === currentUserDisplayName.value,
        ),
      }))
      .filter((issue) => issue.worklogs.length > 0)
  },
  enabled: computed(() => isOverbookedDayPopupOpen.value && currentUserDisplayName.value.length > 0),
  staleTime: 30_000,
  retry: 1,
})

function openPanel(issue: JiraIssueSummary, mode: PanelMode, startedAt?: string): void {
  selectedIssue.value = issue
  panelMode.value = mode
  quickLogStartedAt.value = mode === 'create-worklog' ? (startedAt ?? null) : null
  editingWorklog.value = null
}

function closePanel(): void {
  panelMode.value = null
  quickLogStartedAt.value = null
  editingWorklog.value = null
}

function handleEditWorklog(worklog: JiraWorklog): void {
  editingWorklog.value = worklog
  panelMode.value = 'edit-worklog'
}

function openEditWorklogFromReview(issue: JiraIssueSummary, worklog: JiraWorklog): void {
  closeOverbookedDayPopup()
  selectedIssue.value = issue
  editingWorklog.value = worklog
  panelMode.value = 'edit-worklog'
  quickLogStartedAt.value = null
}

const { mutate: deleteWorklogFromReview, isPending: isDeletingWorklog } = useMutation({
  mutationFn: ({ issueKey, worklogId }: { issueKey: string; worklogId: string }) =>
    jiraApi.deleteWorklog(issueKey, worklogId),
  onSuccess: (_data, variables) => {
    confirmDeleteWorklogId.value = null
    queryClient.invalidateQueries({ queryKey: ['worklogs', variables.issueKey] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-my-open-issues'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-my-month-issues'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-issues-with-worklogs'] })
    queryClient.invalidateQueries({ queryKey: ['my-monthly-worklogs'] })
  },
})

function requestDeleteWorklogFromReview(worklogId: string): void {
  confirmDeleteWorklogId.value = worklogId
}

function cancelDeleteWorklogFromReview(): void {
  confirmDeleteWorklogId.value = null
}

function confirmDeleteWorklogFromReview(issueKey: string, worklogId: string): void {
  deleteWorklogFromReview({ issueKey, worklogId })
}

function handleSaved(): void {
  closePanel()
  if (selectedIssue.value) {
    queryClient.invalidateQueries({ queryKey: ['worklogs', selectedIssue.value.key] })
  }
}

function atStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function readWorklogStarted(value: unknown): Date | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.started !== 'string') return null

  const date = atStartOfDay(new Date(record.started))
  if (Number.isNaN(date.getTime())) return null
  return date
}

function readWorklogSeconds(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  const record = value as Record<string, unknown>

  if (typeof record.timeSpentSeconds === 'number') return record.timeSpentSeconds
  if (typeof record.timeSpent === 'string') {
    try {
      return parseJiraDurationToSeconds(record.timeSpent)
    } catch {
      return 0
    }
  }

  return 0
}

function affectsDay(change: PendingChange, selectedDay: Date): boolean {
  if (change.type === 'create-worklog') {
    const date = readWorklogStarted(change.after)
    return !!date && isSameDay(date, selectedDay)
  }

  if (change.type === 'update-worklog') {
    const oldDate = readWorklogStarted(change.before)
    const newDate = readWorklogStarted(change.after)
    return (!!oldDate && isSameDay(oldDate, selectedDay)) || (!!newDate && isSameDay(newDate, selectedDay))
  }

  if (change.type === 'delete-worklog') {
    const oldDate = readWorklogStarted(change.before)
    return !!oldDate && isSameDay(oldDate, selectedDay)
  }

  return false
}

function formatCompactHours(seconds: number): string {
  if (seconds === 0) return '0h'
  const sign = seconds > 0 ? '+' : '-'
  const hours = Math.abs(seconds) / 3600
  return `${sign}${hours.toFixed(1).replace(/\.0$/, '')}h`
}

function getPendingChangeSummary(change: PendingChange): string {
  if (change.type === 'create-worklog') {
    const seconds = readWorklogSeconds(change.after)
    return `${formatCompactHours(seconds)} (nuevo)`
  }

  if (change.type === 'update-worklog') {
    const oldSeconds = readWorklogSeconds(change.before)
    const newSeconds = readWorklogSeconds(change.after)
    const delta = newSeconds - oldSeconds
    return `${formatCompactHours(delta)} (${formatCompactHours(oldSeconds).replace('+', '')} -> ${formatCompactHours(newSeconds).replace('+', '')})`
  }

  if (change.type === 'delete-worklog') {
    const oldSeconds = readWorklogSeconds(change.before)
    return `${formatCompactHours(-oldSeconds)} (eliminación)`
  }

  return '—'
}

const pendingTypeLabels: Record<string, string> = {
  'create-worklog': 'Crear worklog',
  'update-worklog': 'Actualizar worklog',
  'delete-worklog': 'Borrar worklog',
}

const pendingStatusClasses: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  running: 'bg-yellow-100 text-yellow-700 animate-pulse',
  success: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

const pendingChangesForSelectedDay = computed(() => {
  if (!selectedPendingDayIso.value) return []
  const selectedDay = atStartOfDay(new Date(selectedPendingDayIso.value))

  return changes.value.filter(
    (change) =>
      (change.status === 'draft' || change.status === 'running') &&
      affectsDay(change, selectedDay),
  )
})

const pendingDayLabel = computed(() => {
  if (!selectedPendingDayIso.value) return ''
  return new Date(selectedPendingDayIso.value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
})

const overbookedDayEntries = computed(() => {
  if (!selectedOverbookedDayIso.value) return []
  const selectedDay = atStartOfDay(new Date(selectedOverbookedDayIso.value))

  return (monthlyIssuesWithWorklogs.value ?? []).flatMap((issue) =>
    issue.worklogs
      .filter((worklog) => {
        const started = atStartOfDay(new Date(worklog.started))
        return isSameDay(started, selectedDay)
      })
      .map((worklog) => ({ issue, worklog })),
  )
})

const overbookedDayLabel = computed(() => {
  if (!selectedOverbookedDayIso.value) return ''
  return new Date(selectedOverbookedDayIso.value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
})

const overbookedDayTotalSeconds = computed(() =>
  overbookedDayEntries.value.reduce((sum, entry) => sum + entry.worklog.timeSpentSeconds, 0),
)

const selectableIssuesForQuickLog = computed(() => {
  const map = new Map<string, JiraIssueSummary>()

  for (const issue of myOpenIssues.value ?? []) map.set(issue.key, issue)
  for (const issue of myMonthIssues.value ?? []) map.set(issue.key, issue)

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
})

const filteredIssuesForQuickLog = computed(() => {
  const search = quickLogIssueSearch.value.trim().toLowerCase()
  if (!search) return selectableIssuesForQuickLog.value

  return selectableIssuesForQuickLog.value.filter((issue) => {
    const key = issue.key.toLowerCase()
    const summary = issue.summary.toLowerCase()
    return key.includes(search) || summary.includes(search)
  })
})

function handleChartRequestLog(startedAt: string): void {
  if (selectableIssuesForQuickLog.value.length === 0) return
  quickLogStartedAt.value = startedAt
  selectedQuickLogIssueKey.value = ''
  quickLogIssueSearch.value = ''
  isQuickLogDropdownOpen.value = false
  isTaskPickerOpen.value = true
}

function handleChartRequestPendingReview(dayIso: string): void {
  selectedPendingDayIso.value = dayIso
  isPendingDayPopupOpen.value = true
}

function handleChartRequestOverbookedReview(dayIso: string): void {
  selectedOverbookedDayIso.value = dayIso
  isOverbookedDayPopupOpen.value = true
}

function closePendingDayPopup(): void {
  isPendingDayPopupOpen.value = false
  selectedPendingDayIso.value = null
}

function closeOverbookedDayPopup(): void {
  isOverbookedDayPopupOpen.value = false
  selectedOverbookedDayIso.value = null
  confirmDeleteWorklogId.value = null
}

function closeTaskPicker(): void {
  isTaskPickerOpen.value = false
  selectedQuickLogIssueKey.value = ''
  quickLogIssueSearch.value = ''
  isQuickLogDropdownOpen.value = false
}

function selectQuickLogIssue(issue: JiraIssueSummary): void {
  selectedQuickLogIssueKey.value = issue.key
  quickLogIssueSearch.value = `${issue.key} · ${issue.summary}`
  isQuickLogDropdownOpen.value = false
}

function onQuickLogSearchInput(): void {
  if (!quickLogIssueSearch.value.trim()) {
    selectedQuickLogIssueKey.value = ''
  }
  isQuickLogDropdownOpen.value = true
}

function confirmQuickLogTask(): void {
  const issue = selectableIssuesForQuickLog.value.find((item) => item.key === selectedQuickLogIssueKey.value)
  if (!issue || !quickLogStartedAt.value) return

  closeTaskPicker()
  openPanel(issue, 'create-worklog', quickLogStartedAt.value)
}
</script>

<template>
  <div class="max-w-screen-xl mx-auto px-4 py-6 space-y-4">
    <!-- Header row -->
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-800">Dashboard</h1>
      <ConnectionStatus />
    </div>

    <TrackingSummaryCards title="Mi seguimiento" />

    <VacationDaysSection />

    <DailyHoursChartBlock
      @request-log="handleChartRequestLog"
      @request-pending-review="handleChartRequestPendingReview"
      @request-overbooked-review="handleChartRequestOverbookedReview"
    />

    <section class="space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-700">Mis issues abiertas</h2>
        <button
          class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          @click="() => refetchMyOpenIssues()"
        >
          Actualizar
        </button>
      </div>

      <MyOpenIssuesTable
        :issues="myOpenIssues ?? []"
        :is-loading="isLoadingMyOpenIssues"
        :error="myOpenIssuesErrorMessage"
        @view-worklogs="(issue) => openPanel(issue, 'worklogs')"
        @create-worklog="(issue) => openPanel(issue, 'create-worklog')"
      />
    </section>

    <section class="space-y-2">
      <div class="flex items-center justify-between">
        <button
          class="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          @click="isMonthSectionOpen = !isMonthSectionOpen"
        >
          <span class="text-xs">{{ isMonthSectionOpen ? '▼' : '▶' }}</span>
          <span>Issues del mes</span>
        </button>
        <button
          v-if="isMonthSectionOpen"
          class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          @click="() => refetchMyMonthIssues()"
        >
          Actualizar
        </button>
      </div>

      <div v-if="isMonthSectionOpen" class="animate-in fade-in">
        <MyIssuesTable
          :issues="myMonthIssues ?? []"
          :is-loading="isLoadingMyMonthIssues"
          :error="myMonthIssuesErrorMessage"
          @view-worklogs="(issue) => openPanel(issue, 'worklogs')"
          @create-worklog="(issue) => openPanel(issue, 'create-worklog')"
        />
      </div>
    </section>

    <transition name="modal">
      <div
        v-if="panelMode && selectedIssue"
        class="modal-backdrop"
        @click.self="closePanel"
      >
        <div class="modal-content bg-white border border-gray-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs text-gray-400 font-mono">{{ selectedIssue.key }}</span>
            <button
              class="text-gray-400 hover:text-gray-600 text-lg leading-none"
              @click="closePanel"
            >
              ×
            </button>
          </div>

          <p class="text-sm text-gray-700 font-medium mb-4 truncate" :title="selectedIssue.summary">
            {{ selectedIssue.summary }}
          </p>

          <WorklogList
            v-if="panelMode === 'worklogs'"
            :issue-key="selectedIssue.key"
            @edit-worklog="handleEditWorklog"
            @create-worklog="() => (panelMode = 'create-worklog')"
          />

          <WorklogEditor
            v-else-if="panelMode === 'create-worklog'"
            :issue-key="selectedIssue.key"
            :issue-summary="selectedIssue.summary"
            :initial-started-at="quickLogStartedAt ?? undefined"
            @close="closePanel"
            @saved="handleSaved"
          />

          <WorklogEditor
            v-else-if="panelMode === 'edit-worklog' && editingWorklog"
            :issue-key="selectedIssue.key"
            :issue-summary="selectedIssue.summary"
            :worklog="editingWorklog"
            @close="closePanel"
            @saved="handleSaved"
          />
        </div>
      </div>
    </transition>

    <transition name="modal">
      <div
        v-if="isOverbookedDayPopupOpen"
        class="modal-backdrop"
        @click.self="closeOverbookedDayPopup"
      >
        <div class="modal-content modal-content-pending-review bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-xl">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-gray-700">
                Horas imputadas el día <span class="text-gray-500">{{ overbookedDayLabel }}</span>
              </h3>
              <p class="text-xs text-gray-500">
                Total del día: <span class="font-medium text-red-600">{{ formatCompactHours(overbookedDayTotalSeconds).replace('+', '') }}</span>
              </p>
            </div>
            <button
              class="text-gray-400 hover:text-gray-600 text-lg leading-none"
              @click="closeOverbookedDayPopup"
            >
              ×
            </button>
          </div>

          <div
            v-if="overbookedDayEntries.length === 0"
            class="text-sm text-gray-500 border border-dashed border-gray-200 rounded p-4 text-center"
          >
            No hay worklogs encontrados para este día.
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="entry in overbookedDayEntries"
              :key="`overbooked-${entry.worklog.id}`"
              class="rounded-lg border border-gray-200 bg-gray-50/60 p-4"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="min-w-0 flex-1 space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-mono text-sm font-semibold text-blue-600">{{ entry.issue.key }}</span>
                    <span class="rounded bg-white px-2 py-1 text-[11px] font-medium text-gray-600 border border-gray-200">
                      {{ entry.worklog.timeSpent }}
                    </span>
                    <span class="text-xs text-gray-500">
                      {{ new Date(entry.worklog.started).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }}
                    </span>
                  </div>

                  <p class="text-sm leading-relaxed text-gray-700">{{ entry.issue.summary }}</p>

                  <p v-if="entry.worklog.commentText" class="text-xs leading-relaxed text-gray-500">
                    {{ entry.worklog.commentText }}
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    class="text-xs px-3 py-1.5 rounded border border-blue-300 hover:bg-blue-50 text-blue-600 transition-colors"
                    @click="openEditWorklogFromReview(entry.issue, entry.worklog)"
                  >
                    Editar tiempo
                  </button>
                  <template v-if="confirmDeleteWorklogId === entry.worklog.id">
                    <span class="text-xs text-red-600">¿Borrar?</span>
                    <button
                      class="text-xs px-3 py-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      :disabled="isDeletingWorklog"
                      @click="confirmDeleteWorklogFromReview(entry.issue.key, entry.worklog.id)"
                    >
                      Sí, borrar
                    </button>
                    <button
                      class="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                      :disabled="isDeletingWorklog"
                      @click="cancelDeleteWorklogFromReview"
                    >
                      Cancelar
                    </button>
                  </template>
                  <button
                    v-else
                    class="text-xs px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                    @click="requestDeleteWorklogFromReview(entry.worklog.id)"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <transition name="modal">
      <div
        v-if="isTaskPickerOpen"
        class="modal-backdrop"
        @click.self="closeTaskPicker"
      >
        <div class="modal-content modal-content-task-picker bg-white border border-gray-200 rounded-lg p-4 space-y-4 shadow-xl">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-700">Selecciona una tarea</h3>
            <button
              class="text-gray-400 hover:text-gray-600 text-lg leading-none"
              @click="closeTaskPicker"
            >
              ×
            </button>
          </div>

          <p class="text-xs text-gray-500">
            El día seleccionado no llega a 8 horas. Elige la tarea donde quieres registrar tiempo.
          </p>

          <div class="relative">
            <input
              v-model="quickLogIssueSearch"
              type="text"
              placeholder="Buscar y seleccionar issue..."
              class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              @focus="isQuickLogDropdownOpen = true"
              @input="onQuickLogSearchInput"
            />

            <div
              v-if="isQuickLogDropdownOpen"
              class="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-y-auto"
            >
              <button
                v-for="issue in filteredIssuesForQuickLog"
                :key="`quick-log-${issue.key}`"
                type="button"
                class="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                @mousedown.prevent="selectQuickLogIssue(issue)"
              >
                <span class="font-mono text-blue-700">{{ issue.key }}</span>
                <span class="text-gray-500"> · {{ issue.summary }}</span>
              </button>

              <p v-if="filteredIssuesForQuickLog.length === 0" class="px-3 py-2 text-xs text-gray-500">
                No hay issues que coincidan con la búsqueda.
              </p>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors"
              @click="closeTaskPicker"
            >
              Cancelar
            </button>
            <button
              class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              :disabled="!selectedQuickLogIssueKey"
              @click="confirmQuickLogTask"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="modal">
      <div
        v-if="isPendingDayPopupOpen"
        class="modal-backdrop"
        @click.self="closePendingDayPopup"
      >
        <div class="modal-content modal-content-pending-review bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-xl">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-700">
              Pendientes del día <span class="text-gray-500">{{ pendingDayLabel }}</span>
            </h3>
            <button
              class="text-gray-400 hover:text-gray-600 text-lg leading-none"
              @click="closePendingDayPopup"
            >
              ×
            </button>
          </div>

          <div
            v-if="pendingChangesForSelectedDay.length === 0"
            class="text-sm text-gray-500 border border-dashed border-gray-200 rounded p-4 text-center"
          >
            No hay pendientes para este día.
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="change in pendingChangesForSelectedDay"
              :key="`day-pending-${change.id}`"
              class="rounded-lg border border-gray-200 bg-gray-50/60 p-4"
            >
              <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0 flex-1 space-y-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-mono text-sm font-semibold text-blue-600">{{ change.issueKey }}</span>
                    <span class="rounded bg-white px-2 py-1 text-[11px] font-medium text-gray-600 border border-gray-200">
                      {{ pendingTypeLabels[change.type] ?? change.type }}
                    </span>
                    <span class="text-xs px-2 py-1 rounded font-medium" :class="pendingStatusClasses[change.status]">
                      {{ change.status }}
                    </span>
                  </div>

                  <div v-if="change.issueSummary" class="space-y-1">
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Summary</p>
                    <p class="text-sm leading-relaxed text-gray-700">{{ change.issueSummary }}</p>
                  </div>

                  <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div class="space-y-1">
                      <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Cambio pendiente</p>
                      <p class="text-sm leading-relaxed text-gray-700">{{ getPendingChangeSummary(change) }}</p>
                    </div>

                    <div class="space-y-1">
                      <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Acciones</p>
                      <div class="flex flex-wrap gap-2">
                        <button
                          v-if="change.status === 'draft'"
                          class="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                          :disabled="pendingChangesStore.isExecuting"
                          @click="pendingChangesStore.executeSingle(change.id)"
                        >
                          Ejecutar
                        </button>
                        <button
                          v-if="change.status === 'draft'"
                          class="text-xs px-3 py-1.5 text-red-500 hover:text-red-700 border border-red-300 rounded hover:bg-red-50 transition-colors"
                          @click="pendingChangesStore.removeChange(change.id)"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  width: 24rem;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content-task-picker {
  max-height: none;
  overflow: visible;
}

.modal-content-pending-review {
  width: min(56rem, 92vw);
  max-height: none;
  overflow: visible;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}
</style>

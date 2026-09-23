<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import { useTicketsTableFilters, formatCreatedAt } from '../composables/useTicketsTableFilters'
import { formatOpenDuration, openDurationChipClass } from '../utils/formatOpenDuration'
import TicketDetailsDialog from './TicketDetailsDialog.vue'
import RequestTypeIcon from './RequestTypeIcon.vue'
import type { CdtTicket } from '../types/jira'
import { issueStatusBadgeClass } from '../utils/issueStatus'
import { labelTagClass } from '../utils/labelTag'

const props = defineProps<{
  tickets: CdtTicket[]
  isLoading: boolean
  error: string | null
}>()

const {
  keyQuery,
  linkedKeyQuery,
  requestTypeQuery,
  requestTypeOptions,
  statusQuery,
  statusOptions,
  assigneeQuery,
  createdFrom,
  createdTo,
  noStory,
  assignedOnly,
  unassignedOnly,
  labelQuery,
  labelOptions,
  filteredTickets,
  hasActiveFilters,
  clearFilters,
  isUngestionedActive,
  isAssignedWithoutStoryActive,
  isMyTicketsPreset,
  applyUngestioned,
  applyAssignedWithoutStory,
  applyMyTickets,
  totalCount,
  filteredCount,
} = useTicketsTableFilters(() => props.tickets)

const { data: connectionInfo } = useQuery({
  queryKey: ['jira-connection-info'],
  queryFn: () => jiraApi.getConnectionInfo(),
  retry: false,
})

const { data: currentUser } = useQuery({
  queryKey: ['jira-me'],
  queryFn: () => jiraApi.getMe(),
  retry: false,
})

const myDisplayName = computed(() => currentUser.value?.displayName?.trim() ?? '')
const isMyTicketsActive = computed(() => isMyTicketsPreset(myDisplayName.value))

const ungestionedCount = computed(
  () => props.tickets.filter((ticket) => !ticket.assigneeName.trim() && !ticket.linkedKey.trim()).length,
)

const assignedWithoutStoryCount = computed(
  () => props.tickets.filter((ticket) => ticket.assigneeName.trim().length > 0 && !ticket.linkedKey.trim()).length,
)

const myTicketsCount = computed(() => {
  const mine = myDisplayName.value.toLowerCase()
  if (!mine) return 0
  return props.tickets.filter((ticket) => ticket.assigneeName.trim().toLowerCase() === mine).length
})

const quickFilterButtonClass =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors'
const quickFilterIdleClass = 'border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
const quickFilterActiveClass = 'border-blue-600 bg-blue-600 text-white'

const jiraBaseUrl = computed(() => connectionInfo.value?.jiraBaseUrl?.replace(/\/$/, '') ?? '')

function issueBrowseUrl(issueKey: string): string {
  if (!jiraBaseUrl.value) return '#'
  return `${jiraBaseUrl.value}/browse/${encodeURIComponent(issueKey)}`
}

const selectedTicket = ref<CdtTicket | null>(null)

function openDetails(ticket: CdtTicket): void {
  selectedTicket.value = ticket
}

function closeDetails(): void {
  selectedTicket.value = null
}

const hoveredTooltip = ref<string | null>(null)
const tooltipStyle = ref<{ left: string; top: string } | null>(null)
const createdSort = ref<'asc' | 'desc'>('desc')

const sortedTickets = computed(() => {
  const direction = createdSort.value === 'asc' ? 1 : -1
  return [...filteredTickets.value].sort((a, b) => {
    const aTime = a.created ? Date.parse(a.created) : 0
    const bTime = b.created ? Date.parse(b.created) : 0
    if (aTime === bTime) return 0
    return aTime < bTime ? -direction : direction
  })
})

function toggleCreatedSort(): void {
  createdSort.value = createdSort.value === 'desc' ? 'asc' : 'desc'
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('es-ES')
  const first = parts[0][0] ?? ''
  const second = parts[1][0] ?? ''
  return `${first}${second}`.toLocaleUpperCase('es-ES')
}

const ASSIGNEE_AVATAR_COLORS = [
  'bg-blue-600',
  'bg-indigo-600',
  'bg-violet-600',
  'bg-fuchsia-600',
  'bg-rose-600',
  'bg-orange-600',
  'bg-amber-600',
  'bg-emerald-600',
  'bg-teal-600',
  'bg-cyan-600',
  'bg-sky-600',
  'bg-pink-600',
]

function assigneeAvatarClass(name: string): string {
  let hash = 0
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return ASSIGNEE_AVATAR_COLORS[hash % ASSIGNEE_AVATAR_COLORS.length]
}

function showTooltip(event: MouseEvent, text: string): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  hoveredTooltip.value = text
  tooltipStyle.value = {
    left: `${Math.round(rect.left)}px`,
    top: `${Math.round(rect.bottom + 4)}px`,
  }
}

function hideTooltip(): void {
  hoveredTooltip.value = null
  tooltipStyle.value = null
}
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
    <div v-if="props.isLoading" class="flex items-center justify-center py-10 text-gray-500 text-sm">
      Cargando tickets abiertos...
    </div>

    <div v-else-if="props.error" class="p-4 text-red-600 bg-red-50 text-sm">
      <strong>Error:</strong> {{ props.error }}
    </div>

    <div
      v-else-if="props.tickets.length === 0"
      class="flex items-center justify-center py-10 text-gray-400 text-sm"
    >
      No hay tickets abiertos en CDT.
    </div>

    <div v-else>
      <div class="border-b border-gray-200 bg-gray-50">
        <div class="flex flex-wrap items-center gap-2 px-3 pt-2 pb-1.5">
          <label class="flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap">
            From
            <input
              v-model="createdFrom"
              type="date"
              class="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              :max="createdTo || undefined"
              aria-label="Created from"
            />
          </label>
          <label class="flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap">
            To
            <input
              v-model="createdTo"
              type="date"
              class="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              :min="createdFrom || undefined"
              aria-label="Created to"
            />
          </label>
          <input
            v-model="keyQuery"
            type="search"
            placeholder="Key…"
            class="min-w-[7rem] flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Filtrar por Key"
          />
          <input
            v-model="linkedKeyQuery"
            type="search"
            placeholder="Story…"
            class="min-w-[7rem] flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Filtrar por Story"
          />
          <select
            v-model="requestTypeQuery"
            class="min-w-[8rem] flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Filtrar por Request type"
          >
            <option value="">Request type: todos</option>
            <option v-for="requestType in requestTypeOptions" :key="requestType" :value="requestType">
              {{ requestType }}
            </option>
          </select>
          <select
            v-model="statusQuery"
            class="min-w-[8rem] flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Filtrar por Status"
          >
            <option value="">Status: todos</option>
            <option v-for="status in statusOptions" :key="status" :value="status">
              {{ status }}
            </option>
          </select>
          <select
            v-model="labelQuery"
            class="min-w-[8rem] flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Filtrar por Label"
          >
            <option value="">Label: todos</option>
            <option v-for="label in labelOptions" :key="label" :value="label">
              {{ label }}
            </option>
          </select>
          <input
            v-model="assigneeQuery"
            type="search"
            placeholder="Assigned to…"
            class="min-w-[8rem] flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Filtrar por Assigned to"
          />
          <button
            v-if="hasActiveFilters"
            type="button"
            class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-white"
            @click="clearFilters"
          >
            Limpiar
          </button>
          <span
            v-if="hasActiveFilters"
            class="ml-auto text-[11px] text-gray-500"
          >
            {{ filteredCount }} de {{ totalCount }}
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-4 px-3 pb-2">
          <label class="flex items-center gap-1 text-[11px] text-gray-600 whitespace-nowrap">
            <input
              v-model="noStory"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
            />
            Sin historia
          </label>
          <label class="flex items-center gap-1 text-[11px] text-gray-600 whitespace-nowrap">
            <input
              v-model="assignedOnly"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
            />
            Asignados
          </label>
          <label class="flex items-center gap-1 text-[11px] text-gray-600 whitespace-nowrap">
            <input
              v-model="unassignedOnly"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
            />
            Sin asignar
          </label>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <button
          type="button"
          :class="[quickFilterButtonClass, isUngestionedActive ? quickFilterActiveClass : quickFilterIdleClass]"
          :aria-pressed="isUngestionedActive"
          @click="applyUngestioned"
        >
          Sin gestionar
          <span :class="isUngestionedActive ? 'text-blue-100' : 'text-gray-500'">{{ ungestionedCount }}</span>
        </button>
        <button
          type="button"
          :class="[quickFilterButtonClass, isAssignedWithoutStoryActive ? quickFilterActiveClass : quickFilterIdleClass]"
          :aria-pressed="isAssignedWithoutStoryActive"
          @click="applyAssignedWithoutStory"
        >
          Asignados sin story
          <span :class="isAssignedWithoutStoryActive ? 'text-blue-100' : 'text-gray-500'">{{ assignedWithoutStoryCount }}</span>
        </button>
        <button
          type="button"
          :class="[quickFilterButtonClass, isMyTicketsActive ? quickFilterActiveClass : quickFilterIdleClass]"
          :aria-pressed="isMyTicketsActive"
          :disabled="!myDisplayName"
          @click="applyMyTickets(myDisplayName)"
        >
          Mis tickets
          <span :class="isMyTicketsActive ? 'text-blue-100' : 'text-gray-500'">{{ myTicketsCount }}</span>
        </button>
      </div>

      <div
        v-if="filteredTickets.length === 0"
        class="flex items-center justify-center py-10 text-gray-400 text-sm"
      >
        Ningún ticket coincide con el filtro.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th class="w-10 px-2 py-2 text-left font-medium">
                <span class="sr-only">Tipo de petición</span>
              </th>
              <th class="px-3 py-2 text-left font-medium" :aria-sort="createdSort === 'asc' ? 'ascending' : 'descending'">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 uppercase tracking-wide hover:text-gray-800"
                  :aria-label="createdSort === 'desc' ? 'Ordenar Creado hace ascendente' : 'Ordenar Creado hace descendente'"
                  @click="toggleCreatedSort"
                >
                  Opened
                  <span class="inline-flex flex-col" aria-hidden="true">
                    <svg viewBox="0 0 10 6" class="h-2 w-2" :class="createdSort === 'asc' ? 'text-gray-800' : 'text-gray-300'">
                      <path fill="currentColor" d="M5 0 10 6H0z" />
                    </svg>
                    <svg viewBox="0 0 10 6" class="h-2 w-2" :class="createdSort === 'desc' ? 'text-gray-800' : 'text-gray-300'">
                      <path fill="currentColor" d="M5 6 0 0h10z" />
                    </svg>
                  </span>
                </button>
              </th>
              <th class="px-3 py-2 text-left font-medium">Key</th>
              <th class="px-3 py-2 text-left font-medium">Story</th>
              <th class="w-[500px] min-w-[500px] max-w-[500px] px-3 py-2 text-left font-medium">Summary</th>
              <th class="px-3 py-2 text-left font-medium">Status</th>
              <th class="px-3 py-2 text-left font-medium">Assig</th>
              <th class="px-3 py-2 text-left font-medium">Labels</th>
              <th class="px-3 py-2 text-left font-medium">Details</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="ticket in sortedTickets"
              :key="ticket.id"
              class="hover:bg-blue-50 transition-colors"
            >
              <td class="px-2 py-2 whitespace-nowrap">
                <span
                  v-if="ticket.requestType"
                  class="inline-flex"
                  :aria-label="ticket.requestType"
                  @mouseenter="showTooltip($event, ticket.requestType)"
                  @mouseleave="hideTooltip"
                >
                  <RequestTypeIcon :name="ticket.requestType" />
                </span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td
                class="px-3 py-2 whitespace-nowrap"
                :title="formatCreatedAt(ticket.created) || undefined"
              >
                <span
                  v-if="openDurationChipClass(ticket.created)"
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="openDurationChipClass(ticket.created)"
                >
                  {{ formatOpenDuration(ticket.created) }}
                </span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-3 py-2 font-mono font-medium whitespace-nowrap">
                <a
                  v-if="jiraBaseUrl"
                  class="text-blue-600 hover:text-blue-800 underline"
                  :href="issueBrowseUrl(ticket.key)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ ticket.key }}
                </a>
                <span v-else>{{ ticket.key }}</span>
              </td>
              <td class="px-3 py-2 font-mono font-medium whitespace-nowrap">
                <a
                  v-if="ticket.linkedKey && jiraBaseUrl"
                  class="text-blue-600 hover:text-blue-800 underline"
                  :href="issueBrowseUrl(ticket.linkedKey)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ ticket.linkedKey }}
                </a>
                <span v-else-if="ticket.linkedKey">{{ ticket.linkedKey }}</span>
                <span v-else class="font-sans font-normal text-gray-400">—</span>
              </td>
              <td class="w-[500px] min-w-[500px] max-w-[500px] px-3 py-2 text-gray-800 whitespace-normal break-words">
                {{ ticket.summary }}
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <span
                  v-if="ticket.statusName"
                  class="text-xs px-1.5 py-0.5 rounded font-medium"
                  :class="issueStatusBadgeClass(ticket.statusName)"
                >
                  {{ ticket.statusName }}
                </span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <span
                  v-if="ticket.assigneeName"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold tracking-wide text-white"
                  :class="assigneeAvatarClass(ticket.assigneeName)"
                  :aria-label="ticket.assigneeName"
                  @mouseenter="showTooltip($event, ticket.assigneeName)"
                  @mouseleave="hideTooltip"
                >
                  {{ initialsFromName(ticket.assigneeName) }}
                </span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-3 py-2">
                <div v-if="(ticket.labels ?? []).length > 0" class="flex flex-wrap gap-1">
                  <span
                    v-for="label in ticket.labels"
                    :key="label"
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="labelTagClass(label)"
                  >
                    {{ label }}
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
                  @click="openDetails(ticket)"
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
  </div>

  <Teleport to="body">
    <div
      v-if="hoveredTooltip && tooltipStyle"
      class="pointer-events-none fixed z-50 max-w-lg rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-800 shadow-lg"
      :style="tooltipStyle"
      role="tooltip"
    >
      {{ hoveredTooltip }}
    </div>
  </Teleport>

  <TicketDetailsDialog
    v-if="selectedTicket"
    :ticket="selectedTicket"
    :jira-base-url="jiraBaseUrl"
    @close="closeDetails"
  />
</template>

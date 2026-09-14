<script setup lang="ts">
import { computed } from 'vue'
import ConnectionStatus from '../components/ConnectionStatus.vue'
import TicketsSummaryBarChart, {
  type TicketsSummaryBarItem,
} from '../components/TicketsSummaryBarChart.vue'
import { useCdtOpenTickets } from '../composables/useCdtOpenTickets'
import { issueStatusBadgeClass } from '../utils/issueStatus'
import { labelTagClass } from '../utils/labelTag'

const { tickets, isLoading, errorMessage, refetch } = useCdtOpenTickets()

const summary = computed(() => {
  const rows = tickets.value ?? []
  let incidencia = 0
  let soporte = 0
  let withoutStory = 0
  let assigned = 0
  let unassigned = 0
  const statusCounts = new Map<string, number>()
  const monthCounts = new Map<string, { label: string; count: number }>()
  const labelCounts = new Map<string, number>()

  for (const ticket of rows) {
    const requestType = ticket.requestType.trim().toLowerCase()
    if (requestType === 'incidencia' || requestType === 'incident') incidencia += 1
    if (requestType === 'soporte') soporte += 1
    if (!ticket.linkedKey.trim()) withoutStory += 1
    if (ticket.assigneeName.trim()) assigned += 1
    else unassigned += 1

    const statusName = ticket.statusName.trim()
    if (statusName) statusCounts.set(statusName, (statusCounts.get(statusName) ?? 0) + 1)

    const created = new Date(ticket.created)
    if (!Number.isNaN(created.getTime())) {
      const sortKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`
      const existing = monthCounts.get(sortKey)
      if (existing) {
        existing.count += 1
      } else {
        monthCounts.set(sortKey, {
          label: created.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^./, (char) => char.toUpperCase()),
          count: 1,
        })
      }
    }

    for (const label of ticket.labels ?? []) {
      const name = label.trim()
      if (!name) continue
      labelCounts.set(name, (labelCounts.get(name) ?? 0) + 1)
    }
  }

  const byAssignment: TicketsSummaryBarItem[] = [
    {
      key: 'assigned',
      label: 'Asignados',
      count: assigned,
      to: ticketsListTo({ assigned: '1' }),
    },
    {
      key: 'unassigned',
      label: 'Sin asignar',
      count: unassigned,
      to: ticketsListTo({ unassigned: '1' }),
    },
  ]

  const byStatus: TicketsSummaryBarItem[] = [...statusCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([name, count]) => ({
      key: name,
      label: name,
      count,
      to: ticketsListTo({ status: name }),
      tagClass: issueStatusBadgeClass(name),
    }))

  const byMonth: TicketsSummaryBarItem[] = [...monthCounts.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([sortKey, item]) => {
      const [year, month] = sortKey.split('-').map(Number)
      const lastDay = String(new Date(year, month, 0).getDate()).padStart(2, '0')
      return {
        key: sortKey,
        label: item.label,
        count: item.count,
        to: ticketsListTo({ from: `${sortKey}-01`, to: `${sortKey}-${lastDay}` }),
      }
    })

  const byLabel: TicketsSummaryBarItem[] = [...labelCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([name, count]) => ({
      key: name,
      label: name,
      count,
      to: ticketsListTo({ label: name }),
      tagClass: labelTagClass(name),
    }))

  return {
    total: rows.length,
    incidencia,
    soporte,
    withoutStory,
    byAssignment,
    byStatus,
    byMonth,
    byLabel,
  }
})

function ticketsListTo(query: Record<string, string>) {
  return { path: '/tickets/lista', query }
}

const cardClass = 'bg-white border border-gray-200 rounded-lg p-4'
const cardLinkClass = `${cardClass} block transition-colors hover:border-blue-300 hover:bg-blue-50/40`
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-800">Resumen</h1>
      <div class="flex items-center gap-2">
        <button
          class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          @click="() => refetch()"
        >
          Actualizar
        </button>
        <ConnectionStatus />
      </div>
    </div>

    <div v-if="isLoading" class="text-sm text-gray-500">Cargando resumen...</div>
    <div v-else-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</div>
    <template v-else>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div :class="cardClass">
          <p class="text-xs text-gray-500">Total</p>
          <p class="text-2xl font-semibold text-gray-800">{{ summary.total }}</p>
        </div>
        <RouterLink :to="ticketsListTo({ requestType: 'Incidencia' })" :class="cardLinkClass">
          <p class="text-xs text-gray-500">Incidencia</p>
          <p class="text-2xl font-semibold text-gray-800">{{ summary.incidencia }}</p>
        </RouterLink>
        <RouterLink :to="ticketsListTo({ requestType: 'Soporte' })" :class="cardLinkClass">
          <p class="text-xs text-gray-500">Soporte</p>
          <p class="text-2xl font-semibold text-gray-800">{{ summary.soporte }}</p>
        </RouterLink>
        <RouterLink :to="ticketsListTo({ noStory: '1' })" :class="cardLinkClass">
          <p class="text-xs text-gray-500">Sin historia</p>
          <p class="text-2xl font-semibold text-gray-800">{{ summary.withoutStory }}</p>
        </RouterLink>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TicketsSummaryBarChart title="Por asignación" :items="summary.byAssignment" />
        <TicketsSummaryBarChart title="Por status" :items="summary.byStatus" />
        <TicketsSummaryBarChart title="Por mes" :items="summary.byMonth" />
        <TicketsSummaryBarChart title="Por label" :items="summary.byLabel" />
      </div>
    </template>
  </div>
</template>

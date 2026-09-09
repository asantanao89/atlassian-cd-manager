<script setup lang="ts">
import { computed } from 'vue'
import ConnectionStatus from '../components/ConnectionStatus.vue'
import { useCdtOpenTickets } from '../composables/useCdtOpenTickets'
import { issueStatusBadgeClass } from '../utils/issueStatus'

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
          label: created.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
          count: 1,
        })
      }
    }
  }

  const byStatus = [...statusCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([name, count]) => ({ name, count }))

  const byMonth = [...monthCounts.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([sortKey, item]) => {
      const [year, month] = sortKey.split('-').map(Number)
      const lastDay = String(new Date(year, month, 0).getDate()).padStart(2, '0')
      return {
        ...item,
        sortKey,
        from: `${sortKey}-01`,
        to: `${sortKey}-${lastDay}`,
      }
    })

  return {
    total: rows.length,
    incidencia,
    soporte,
    withoutStory,
    assigned,
    unassigned,
    byStatus,
    byMonth,
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

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-gray-700">Por asignación</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RouterLink :to="ticketsListTo({ assigned: '1' })" :class="cardLinkClass">
            <p class="text-xs text-gray-500">Asignados</p>
            <p class="text-2xl font-semibold text-gray-800">{{ summary.assigned }}</p>
          </RouterLink>
          <RouterLink :to="ticketsListTo({ unassigned: '1' })" :class="cardLinkClass">
            <p class="text-xs text-gray-500">Sin asignar</p>
            <p class="text-2xl font-semibold text-gray-800">{{ summary.unassigned }}</p>
          </RouterLink>
        </div>
      </section>

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-gray-700">Por status</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RouterLink
            v-for="item in summary.byStatus"
            :key="item.name"
            :to="ticketsListTo({ status: item.name })"
            :class="cardLinkClass"
          >
            <p class="text-xs text-gray-500">
              <span
                class="inline-flex rounded px-1.5 py-0.5 font-medium"
                :class="issueStatusBadgeClass(item.name)"
              >
                {{ item.name }}
              </span>
            </p>
            <p class="mt-1 text-2xl font-semibold text-gray-800">{{ item.count }}</p>
          </RouterLink>
        </div>
      </section>

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-gray-700">Por mes</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RouterLink
            v-for="item in summary.byMonth"
            :key="item.sortKey"
            :to="ticketsListTo({ from: item.from, to: item.to })"
            :class="cardLinkClass"
          >
            <p class="text-xs text-gray-500 capitalize">{{ item.label }}</p>
            <p class="text-2xl font-semibold text-gray-800">{{ item.count }}</p>
          </RouterLink>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePendingChangesStore } from '../stores/pendingChanges.store'

const store = usePendingChangesStore()
const expandedRows = ref<Set<string>>(new Set())
const hasSummaryColumn = computed(() =>
  store.changes.some((change) => typeof change.issueSummary === 'string' && change.issueSummary.trim().length > 0),
)

const typeLabels: Record<string, string> = {
  'create-worklog': 'Crear worklog',
  'update-worklog': 'Actualizar worklog',
  'delete-worklog': 'Borrar worklog',
}

const statusClasses: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  running: 'bg-yellow-100 text-yellow-700 animate-pulse',
  success: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

function formatValue(value: unknown): string {
  if (!value) return '—'
  return JSON.stringify(value, null, 2)
}

function getTimeSpentFromWorklog(worklog: unknown): string {
  if (!worklog || typeof worklog !== 'object') return '—'
  const record = worklog as Record<string, unknown>
  
  if (typeof record.timeSpent === 'string') return record.timeSpent
  if (typeof record.timeSpentSeconds === 'number') {
    const hours = record.timeSpentSeconds / 3600
    return `${hours.toFixed(1).replace(/\.0$/, '')}h`
  }
  return '—'
}

function getDateFromWorklog(worklog: unknown): string {
  if (!worklog || typeof worklog !== 'object') return ''
  const record = worklog as Record<string, unknown>
  
  if (typeof record.started === 'string') {
    const date = new Date(record.started)
    return date.toLocaleDateString('es-ES')
  }
  return ''
}

function getSummary(changeType: string, before: unknown, after: unknown): string {
  if (changeType === 'create-worklog') {
    const timeSpent = getTimeSpentFromWorklog(after)
    const date = getDateFromWorklog(after)
    return `${timeSpent}${date ? ` el ${date}` : ''}`
  }

  if (changeType === 'update-worklog') {
    const beforeTime = getTimeSpentFromWorklog(before)
    const afterTime = getTimeSpentFromWorklog(after)
    const date = getDateFromWorklog(after)
    return `${beforeTime} → ${afterTime}${date ? ` (${date})` : ''}`
  }

  if (changeType === 'delete-worklog') {
    const timeSpent = getTimeSpentFromWorklog(before)
    const date = getDateFromWorklog(before)
    return `${timeSpent}${date ? ` del ${date}` : ''}`
  }

  return '—'
}

function toggleExpandedRow(changeId: string): void {
  if (expandedRows.value.has(changeId)) {
    expandedRows.value.delete(changeId)
  } else {
    expandedRows.value.add(changeId)
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-700">
        Cambios pendientes
        <span class="text-gray-400 font-normal">({{ store.changes.length }})</span>
      </h3>
      <div class="flex gap-2">
        <button
          v-if="store.changes.some((c) => c.status === 'success')"
          class="text-xs px-3 py-1.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition-colors"
          @click="store.clearCompleted()"
        >
          Limpiar completados
        </button>
        <button
          class="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
          :disabled="
            store.isExecuting ||
            store.changes.filter((c) => c.status === 'draft').length === 0
          "
          @click="store.executeAll()"
        >
          {{ store.isExecuting ? 'Ejecutando...' : 'Ejecutar todos' }}
        </button>
      </div>
    </div>

    <div
      v-if="store.changes.length === 0"
      class="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded"
    >
      No hay cambios pendientes.
    </div>

    <div v-else class="overflow-x-auto border border-gray-200 rounded-lg">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50">
            <th class="px-4 py-3 text-left font-medium text-xs text-gray-500 uppercase">Issue</th>
            <th
              v-if="hasSummaryColumn"
              class="px-4 py-3 text-left font-medium text-xs text-gray-500 uppercase"
            >
              Summary
            </th>
            <th class="px-4 py-3 text-left font-medium text-xs text-gray-500 uppercase">Tipo</th>
            <th class="px-4 py-3 text-left font-medium text-xs text-gray-500 uppercase">Resumen</th>
            <th class="px-4 py-3 text-left font-medium text-xs text-gray-500 uppercase">Estado</th>
            <th class="px-4 py-3 text-right font-medium text-xs text-gray-500 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <template v-for="change in store.changes" :key="change.id">
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-3 font-mono font-medium text-blue-600">{{ change.issueKey }}</td>
              <td
                v-if="hasSummaryColumn"
                class="px-4 py-3 text-gray-600 max-w-xs truncate"
                :title="change.issueSummary"
              >
                {{ change.issueSummary ?? '—' }}
              </td>
              <td class="px-4 py-3 text-gray-600">{{ typeLabels[change.type] ?? change.type }}</td>
              <td class="px-4 py-3 text-gray-600">
                {{ getSummary(change.type, change.before, change.after) }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="text-xs px-2 py-1 rounded font-medium"
                  :class="statusClasses[change.status]"
                >
                  {{ change.status }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    v-if="change.status === 'draft'"
                    class="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                    :disabled="store.isExecuting"
                    @click="store.executeSingle(change.id)"
                  >
                    Ejecutar
                  </button>
                  <button
                    v-if="change.status === 'draft'"
                    class="text-xs px-2 py-1 text-red-500 hover:text-red-700 border border-red-300 rounded hover:bg-red-50 transition-colors"
                    @click="store.removeChange(change.id)"
                  >
                    Eliminar
                  </button>
                  <button
                    class="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                    @click="toggleExpandedRow(change.id)"
                  >
                    {{ expandedRows.has(change.id) ? '▼' : '▶' }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="expandedRows.has(change.id)" class="bg-gray-50 border-b border-gray-100">
              <td :colspan="hasSummaryColumn ? 6 : 5" class="px-4 py-3">
                <div v-if="change.errorMessage" class="mb-3 text-xs text-red-600 bg-red-50 rounded p-2">
                  <strong>Error:</strong> {{ change.errorMessage }}
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs font-medium text-gray-500 mb-2">Antes</p>
                    <pre class="bg-white rounded p-2 overflow-auto text-xs text-gray-600 border border-gray-200">{{ formatValue(change.before) }}</pre>
                  </div>
                  <div>
                    <p class="text-xs font-medium text-gray-500 mb-2">Después</p>
                    <pre class="bg-blue-50 rounded p-2 overflow-auto text-xs text-blue-700 border border-blue-200">{{ formatValue(change.after) }}</pre>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

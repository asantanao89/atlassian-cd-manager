<script setup lang="ts">
import { ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { JiraWorklog } from '../types/jira'
import { jiraApi } from '../api/jiraApi'

const props = defineProps<{
  issueKey: string
}>()

const emit = defineEmits<{
  editWorklog: [worklog: JiraWorklog]
  createWorklog: []
}>()

const queryClient = useQueryClient()
const confirmDeleteId = ref<string | null>(null)

const { data, isLoading, isError, error } = useQuery({
  queryKey: ['worklogs', props.issueKey],
  queryFn: () => jiraApi.getWorklogs(props.issueKey),
})

const { mutate: deleteWorklog, isPending: isDeleting } = useMutation({
  mutationFn: (worklogId: string) => jiraApi.deleteWorklog(props.issueKey, worklogId),
  onSuccess: () => {
    confirmDeleteId.value = null
    queryClient.invalidateQueries({ queryKey: ['worklogs', props.issueKey] })
    queryClient.invalidateQueries({ queryKey: ['issues'] })
  },
})

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function requestDelete(id: string): void {
  confirmDeleteId.value = id
}

function cancelDelete(): void {
  confirmDeleteId.value = null
}

function confirmDelete(id: string): void {
  deleteWorklog(id)
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-700">
        Worklogs —
        <span class="font-mono text-blue-600">{{ props.issueKey }}</span>
        <span v-if="data" class="font-normal text-gray-400 text-xs ml-1">({{ data.total }})</span>
      </h3>
      <button
        class="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
        @click="emit('createWorklog')"
      >
        + Añadir worklog
      </button>
    </div>

    <div v-if="isLoading" class="text-sm text-gray-500 py-4 text-center">Cargando worklogs...</div>

    <div v-else-if="isError" class="text-sm text-red-600 bg-red-50 rounded p-3">
      {{ error instanceof Error ? error.message : 'Error al cargar worklogs' }}
    </div>

    <div
      v-else-if="!data || data.worklogs.length === 0"
      class="text-sm text-gray-400 py-4 text-center"
    >
      No hay worklogs registrados.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="wl in data.worklogs"
        :key="wl.id"
        class="border border-gray-200 rounded p-3 text-sm hover:border-gray-300 transition-colors"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono font-medium text-gray-800">{{ wl.timeSpent }}</span>
              <span class="text-gray-400 text-xs">{{ formatDate(wl.started) }}</span>
              <span class="text-gray-500 text-xs">— {{ wl.authorDisplayName }}</span>
            </div>
            <p v-if="wl.commentText" class="text-gray-600 mt-1 truncate" :title="wl.commentText">
              {{ wl.commentText }}
            </p>
          </div>

          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              class="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-600 transition-colors"
              @click="emit('editWorklog', wl)"
            >
              Editar
            </button>

            <template v-if="confirmDeleteId === wl.id">
              <span class="text-xs text-red-600">¿Confirmar?</span>
              <button
                class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                :disabled="isDeleting"
                @click="confirmDelete(wl.id)"
              >
                Sí, borrar
              </button>
              <button
                class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                @click="cancelDelete"
              >
                Cancelar
              </button>
            </template>
            <button
              v-else
              class="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
              @click="requestDelete(wl.id)"
            >
              Borrar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

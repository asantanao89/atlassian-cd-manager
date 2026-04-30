<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { JiraWorklog } from '../types/jira'
import { jiraApi } from '../api/jiraApi'
import type { CreateWorklogParams } from '../api/jiraApi'
import { isValidJiraDuration } from '../utils/jiraDuration'
import { usePendingChangesStore } from '../stores/pendingChanges.store'

const props = defineProps<{
  issueKey: string
  issueSummary?: string
  initialStartedAt?: string
  worklog?: JiraWorklog // present when editing
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const queryClient = useQueryClient()
const pendingStore = usePendingChangesStore()

const isEdit = computed(() => !!props.worklog)

// Format a date to the Jira started format: YYYY-MM-DDTHH:mm:ss.SSSZ
function toJiraDate(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const y = date.getFullYear()
  const mo = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const mi = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  const ms = pad(date.getMilliseconds(), 3)
  // get timezone offset
  const tz = -date.getTimezoneOffset()
  const sign = tz >= 0 ? '+' : '-'
  const tzH = pad(Math.floor(Math.abs(tz) / 60))
  const tzM = pad(Math.abs(tz) % 60)
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}${sign}${tzH}${tzM}`
}

function localDatetimeValue(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const timeSpent = ref(props.worklog?.timeSpent ?? '')
const startedLocal = ref(localDatetimeValue(props.worklog?.started ?? props.initialStartedAt))
const comment = ref(props.worklog?.commentText ?? '')
const adjustEstimate = ref<'auto' | 'leave' | 'new' | 'manual'>('auto')
const newEstimate = ref('')
const increaseBy = ref('')
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  errors.value = {}
  if (!timeSpent.value.trim()) {
    errors.value.timeSpent = 'El tiempo es obligatorio'
  } else if (!isValidJiraDuration(timeSpent.value)) {
    errors.value.timeSpent = 'Formato inválido. Ej: 1h 30m, 2d, 1w'
  }
  if (!startedLocal.value) {
    errors.value.started = 'La fecha de inicio es obligatoria'
  }
  if (adjustEstimate.value === 'new' && newEstimate.value && !isValidJiraDuration(newEstimate.value)) {
    errors.value.newEstimate = 'Formato inválido'
  }
  if (adjustEstimate.value === 'new' && !newEstimate.value.trim()) {
    errors.value.newEstimate = 'La nueva estimación es obligatoria'
  }
  if (adjustEstimate.value === 'manual' && !increaseBy.value.trim()) {
    errors.value.increaseBy = 'El incremento es obligatorio'
  }
  if (adjustEstimate.value === 'manual' && increaseBy.value && !isValidJiraDuration(increaseBy.value)) {
    errors.value.increaseBy = 'Formato inválido. Ej: 30m, 1h'
  }
  return Object.keys(errors.value).length === 0
}

function buildParams(): CreateWorklogParams {
  const started = toJiraDate(new Date(startedLocal.value))
  const params: CreateWorklogParams = {
    timeSpent: timeSpent.value.trim(),
    started,
    comment: comment.value.trim(),
    adjustEstimate: adjustEstimate.value,
  }
  if (adjustEstimate.value === 'new' && newEstimate.value) params.newEstimate = newEstimate.value
  if (adjustEstimate.value === 'manual' && increaseBy.value) params.increaseBy = increaseBy.value
  return params
}

const { mutate: save, isPending, error: saveError } = useMutation({
  mutationFn: () => {
    const params = buildParams()
    if (isEdit.value && props.worklog) {
      return jiraApi.updateWorklog(props.issueKey, props.worklog.id, params)
    }
    return jiraApi.createWorklog(props.issueKey, params)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['worklogs', props.issueKey] })
    queryClient.invalidateQueries({ queryKey: ['issues'] })
    emit('saved')
  },
})

function handleSave(): void {
  if (!validate()) return
  save()
}

function addToPending(): void {
  if (!validate()) return
  const params = buildParams()
  if (isEdit.value && props.worklog) {
    pendingStore.addChange(
      props.issueKey,
      'update-worklog',
      props.worklog,
      { ...params, worklogId: props.worklog.id },
      props.issueSummary,
    )
  } else {
    pendingStore.addChange(props.issueKey, 'create-worklog', null, params, props.issueSummary)
  }
  emit('close')
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-semibold text-gray-700">
      {{ isEdit ? 'Editar worklog' : 'Nuevo worklog' }} —
      <span class="font-mono text-blue-600">{{ props.issueKey }}</span>
    </h3>

    <div class="space-y-3">
      <!-- Time spent -->
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">
          Tiempo dedicado <span class="text-red-500">*</span>
        </label>
        <input
          v-model="timeSpent"
          type="text"
          placeholder="Ej: 1h 30m"
          class="w-full border rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          :class="errors.timeSpent ? 'border-red-400' : 'border-gray-300'"
        />
        <p v-if="errors.timeSpent" class="text-xs text-red-600 mt-1">{{ errors.timeSpent }}</p>
      </div>

      <!-- Started -->
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">
          Fecha y hora de inicio <span class="text-red-500">*</span>
        </label>
        <input
          v-model="startedLocal"
          type="datetime-local"
          class="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          :class="errors.started ? 'border-red-400' : 'border-gray-300'"
        />
        <p v-if="errors.started" class="text-xs text-red-600 mt-1">{{ errors.started }}</p>
      </div>

      <!-- Comment -->
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Comentario (opcional)</label>
        <textarea
          v-model="comment"
          rows="2"
          class="w-full border border-gray-300 rounded px-3 py-1.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Descripción del trabajo realizado"
        />
      </div>

      <!-- Adjust estimate -->
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Ajuste de estimación</label>
        <select
          v-model="adjustEstimate"
          class="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="auto">auto (restar tiempo dedicado)</option>
          <option value="leave">leave (no modificar)</option>
          <option value="new">new (establecer nuevo valor)</option>
          <option value="manual">manual (incrementar)</option>
        </select>
      </div>

      <div v-if="adjustEstimate === 'new'">
        <label class="block text-xs font-medium text-gray-600 mb-1">Nueva estimación restante</label>
        <input
          v-model="newEstimate"
          type="text"
          placeholder="Ej: 2h"
          class="w-full border rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          :class="errors.newEstimate ? 'border-red-400' : 'border-gray-300'"
        />
        <p v-if="errors.newEstimate" class="text-xs text-red-600 mt-1">{{ errors.newEstimate }}</p>
      </div>

      <div v-if="adjustEstimate === 'manual'">
        <label class="block text-xs font-medium text-gray-600 mb-1">Incrementar restante en</label>
        <input
          v-model="increaseBy"
          type="text"
          placeholder="Ej: 30m"
          class="w-full border rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          :class="errors.increaseBy ? 'border-red-400' : 'border-gray-300'"
        />
        <p v-if="errors.increaseBy" class="text-xs text-red-600 mt-1">{{ errors.increaseBy }}</p>
      </div>
    </div>

    <div
      v-if="saveError"
      class="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2"
    >
      {{ saveError instanceof Error ? saveError.message : 'Error al guardar' }}
    </div>

    <div class="flex gap-2 justify-end pt-2 border-t border-gray-100">
      <button
        class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors"
        @click="emit('close')"
      >
        Cancelar
      </button>
      <button
        class="px-3 py-1.5 text-sm border border-orange-300 rounded hover:bg-orange-50 text-orange-600 transition-colors"
        @click="addToPending"
      >
        Añadir a pendientes
      </button>
      <button
        class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
        :disabled="isPending"
        @click="handleSave"
      >
        {{ isPending ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear' }}
      </button>
    </div>
  </div>
</template>

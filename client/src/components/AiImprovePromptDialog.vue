<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { aiApi } from '../api/aiApi'
import { HttpError } from '../api/httpClient'
import {
  fieldLabel as resolveFieldLabel,
  type AiImprovePromptContext,
  type ImproveFieldId,
} from '../utils/aiImprovePrompt'

const props = defineProps<{
  field: ImproveFieldId
  context: AiImprovePromptContext
}>()

const emit = defineEmits<{
  close: []
  apply: [improvedValue: string]
}>()

const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const improvedValue = ref('')
const rationale = ref<string | null>(null)
const missingSections = ref<string[]>([])
const followUpQuestions = ref<string[]>([])
const isOpen = ref(true)
let requestId = 0

const label = computed(() => resolveFieldLabel(props.field))
const isSummary = computed(() => props.field === 'summary')
const isAcceptanceCriteria = computed(() => props.field === 'acceptanceCriteria')
const showGaps = computed(
  () =>
    (props.field === 'description' || props.field === 'acceptanceCriteria') &&
    (missingSections.value.length > 0 || followUpQuestions.value.length > 0),
)
const resultRows = computed(() =>
  props.field === 'description' || props.field === 'acceptanceCriteria' ? 12 : 4,
)

function close(): void {
  isOpen.value = false
  requestId += 1
  emit('close')
}

function apply(): void {
  if (!improvedValue.value.trim()) return
  emit('apply', improvedValue.value.trim())
}

async function startImprove(): Promise<void> {
  if (
    isSummary.value &&
    !props.context.summary.trim() &&
    !props.context.description.trim()
  ) {
    errorMessage.value =
      'Rellena Summary o Description antes de mejorar el Summary con IA.'
    return
  }

  if (
    isAcceptanceCriteria.value &&
    !props.context.acceptanceCriteria.trim() &&
    !props.context.summary.trim() &&
    !props.context.description.trim()
  ) {
    errorMessage.value =
      'Rellena Summary o Description (o una lista de criterios) antes de generar la tabla.'
    return
  }

  const currentRequest = ++requestId
  const contextSnapshot: AiImprovePromptContext = { ...props.context }

  isLoading.value = true
  errorMessage.value = null
  improvedValue.value = ''
  rationale.value = null
  missingSections.value = []
  followUpQuestions.value = []

  try {
    const result = await aiApi.improveField({
      fields: [props.field],
      summary: contextSnapshot.summary,
      description: contextSnapshot.description,
      acceptanceCriteria: contextSnapshot.acceptanceCriteria,
      componentName: contextSnapshot.componentName,
      valor: contextSnapshot.valor,
      projectKey: contextSnapshot.projectKey,
      projectName: contextSnapshot.projectName,
      issueTypeName: contextSnapshot.issueTypeName,
      unOptionValue: contextSnapshot.unOptionValue,
    })

    if (currentRequest !== requestId || !isOpen.value) return

    improvedValue.value = result.improvedValue || result.improvedSummary || ''
    rationale.value = result.rationale?.trim() || null
    missingSections.value = result.missingSections ?? []
    followUpQuestions.value = result.followUpQuestions ?? []
  } catch (err) {
    if (currentRequest !== requestId || !isOpen.value) return
    errorMessage.value =
      err instanceof HttpError
        ? err.message
        : 'No se pudo mejorar el campo con Codex.'
  } finally {
    if (currentRequest === requestId) {
      isLoading.value = false
    }
  }
}

onMounted(() => {
  void startImprove()
})

onUnmounted(() => {
  requestId += 1
})
</script>

<template>
  <div
    v-if="isOpen"
    class="mb-2 rounded-md border border-indigo-200 bg-indigo-50/60 p-3 space-y-3"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-900">AI · {{ label }}</h2>
        <p class="text-xs text-gray-500 mt-0.5">
          <template v-if="isAcceptanceCriteria">
            Si el campo está vacío, genera la tabla desde Summary y Description.
            Si hay una lista, la convierte a tabla DADO / CUANDO / ENTONCES.
          </template>
          <template v-else-if="isSummary">
            Si el Summary está vacío, lo genera desde la Description.
            Si ambos están vacíos, no consulta a la IA.
          </template>
          <template v-else>Solo actualiza este campo al aplicar.</template>
        </p>
      </div>
      <button
        type="button"
        class="text-gray-400 hover:text-gray-600 text-sm px-1"
        aria-label="Cerrar"
        @click="close"
      >
        ✕
      </button>
    </div>

    <div
      v-if="isLoading"
      class="rounded-md border border-indigo-100 bg-white px-4 py-4 text-center space-y-2"
    >
      <div
        class="mx-auto h-7 w-7 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin"
      />
      <p class="text-sm text-indigo-800 font-medium">Mejorando {{ label }}…</p>
    </div>

    <p v-else-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

    <div v-else-if="improvedValue" class="space-y-3">
      <div
        v-if="showGaps"
        class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 space-y-2"
      >
        <p class="text-xs font-semibold text-amber-900">Falta información</p>
        <div v-if="missingSections.length > 0">
          <p class="text-xs text-amber-800 mb-1">Secciones incompletas:</p>
          <ul class="list-disc list-inside text-xs text-amber-900 space-y-0.5">
            <li v-for="section in missingSections" :key="section">{{ section }}</li>
          </ul>
        </div>
        <div v-if="followUpQuestions.length > 0">
          <p class="text-xs text-amber-800 mb-1">Preguntas para completar:</p>
          <ul class="list-disc list-inside text-xs text-amber-900 space-y-0.5">
            <li v-for="question in followUpQuestions" :key="question">{{ question }}</li>
          </ul>
        </div>
        <p class="text-[11px] text-amber-700">
          Edita la respuesta abajo con lo que falte y pulsa Aplicar.
        </p>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Respuesta</label>
        <textarea
          v-model="improvedValue"
          :rows="resultRows"
          class="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>
      <p v-if="rationale" class="text-xs text-gray-500 whitespace-pre-wrap">
        {{ rationale }}
      </p>
    </div>

    <div class="flex gap-2 justify-end">
      <button
        type="button"
        class="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-600 transition-colors"
        @click="close"
      >
        {{ isLoading ? 'Cancelar' : 'Cerrar' }}
      </button>
      <button
        v-if="!isLoading && errorMessage"
        type="button"
        class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
        @click="startImprove"
      >
        Reintentar
      </button>
      <button
        v-if="!isLoading && !errorMessage && improvedValue"
        type="button"
        class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        @click="apply"
      >
        Aplicar
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { jiraApi } from '../api/jiraApi'
import type { ManualRule, ManualRuleInput, ManualRuleUserInput } from '../types/jira'

const props = defineProps<{
  issueId: string
}>()

const rootEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const isLoading = ref(false)
const isSubmitting = ref(false)
const loadError = ref<string | null>(null)
const submitError = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const rules = ref<ManualRule[]>([])
const selectedRule = ref<ManualRule | null>(null)
const inputValues = ref<Record<string, string>>({})
const menuPosition = ref({ top: 0, left: 0, minWidth: 280 })

function defaultInputValue(input: ManualRuleInput): string {
  if (input.inputType === 'BOOLEAN') return input.defaultValue === true ? 'true' : 'false'
  if (input.inputType === 'DROPDOWN') return ''
  return input.defaultValue == null ? '' : String(input.defaultValue)
}

function openRule(rule: ManualRule): void {
  submitError.value = null
  successMessage.value = null
  if (rule.inputs.length === 0) {
    void runRule(rule, {})
    return
  }
  selectedRule.value = rule
  inputValues.value = Object.fromEntries(
    rule.inputs.map((input) => [input.variableName, defaultInputValue(input)]),
  )
}

function buildUserInputs(rule: ManualRule): Record<string, ManualRuleUserInput> | null {
  const userInputs: Record<string, ManualRuleUserInput> = {}
  for (const input of rule.inputs) {
    const raw = inputValues.value[input.variableName] ?? ''
    if (input.inputType === 'BOOLEAN') {
      userInputs[input.variableName] = { inputType: input.inputType, value: raw === 'true' }
      continue
    }
    if (!raw.trim()) {
      if (input.required) {
        submitError.value = `Falta ${input.displayName}`
        return null
      }
      continue
    }
    if (input.inputType === 'NUMBER') {
      const value = Number(raw)
      if (!Number.isFinite(value)) {
        submitError.value = `${input.displayName} tiene que ser un número`
        return null
      }
      userInputs[input.variableName] = { inputType: input.inputType, value }
      continue
    }
    userInputs[input.variableName] = { inputType: input.inputType, value: raw }
  }
  return userInputs
}

async function runRule(
  rule: ManualRule,
  userInputs: Record<string, ManualRuleUserInput>,
): Promise<void> {
  if (isSubmitting.value) return
  isSubmitting.value = true
  submitError.value = null
  successMessage.value = null
  try {
    await jiraApi.invokeManualRule(props.issueId, rule.id, userInputs)
    selectedRule.value = null
    successMessage.value = 'Automatismo lanzado'
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'No se pudo lanzar el automatismo'
  } finally {
    isSubmitting.value = false
  }
}

function submitSelectedRule(): void {
  const rule = selectedRule.value
  if (!rule) return
  const userInputs = buildUserInputs(rule)
  if (!userInputs) return
  void runRule(rule, userInputs)
}

async function loadRules(): Promise<void> {
  isLoading.value = true
  loadError.value = null
  try {
    const result = await jiraApi.listManualRules(props.issueId)
    rules.value = result.rules
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudieron cargar los automatismos'
    rules.value = []
  } finally {
    isLoading.value = false
  }
}

async function toggleMenu(): Promise<void> {
  if (isSubmitting.value) return
  if (isOpen.value) {
    isOpen.value = false
    return
  }
  isOpen.value = true
  selectedRule.value = null
  submitError.value = null
  successMessage.value = null
  await nextTick()
  updateMenuPosition()
  await loadRules()
  await nextTick()
  updateMenuPosition()
}

function onDocumentPointerDown(event: MouseEvent): void {
  if (!isOpen.value) return
  const target = event.target as Node | null
  if (!target) return
  const clickedInsideTrigger = rootEl.value?.contains(target) ?? false
  const clickedInsideMenu = menuEl.value?.contains(target) ?? false
  if (!clickedInsideTrigger && !clickedInsideMenu) isOpen.value = false
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') isOpen.value = false
}

function updateMenuPosition(): void {
  if (!isOpen.value || !rootEl.value) return
  const triggerRect = rootEl.value.getBoundingClientRect()
  const menuRect = menuEl.value?.getBoundingClientRect()
  const menuWidth = Math.max(menuRect?.width ?? 280, 280)
  const menuHeight = menuRect?.height ?? 180
  const gap = 4
  const padding = 8
  let left = triggerRect.right - menuWidth
  if (left < padding) left = padding
  if (left + menuWidth > window.innerWidth - padding) {
    left = window.innerWidth - padding - menuWidth
  }
  const spaceBelow = window.innerHeight - triggerRect.bottom - padding
  const spaceAbove = triggerRect.top - padding
  const shouldOpenUp = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow
  let top = shouldOpenUp ? triggerRect.top - menuHeight - gap : triggerRect.bottom + gap
  if (top < padding) top = padding
  menuPosition.value = {
    top: Math.round(top),
    left: Math.round(left),
    minWidth: 280,
  }
}

watch([isLoading, selectedRule, successMessage], async () => {
  if (!isOpen.value) return
  await nextTick()
  updateMenuPosition()
})

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('resize', updateMenuPosition)
  window.addEventListener('scroll', updateMenuPosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', updateMenuPosition)
  window.removeEventListener('scroll', updateMenuPosition, true)
})
</script>

<template>
  <div ref="rootEl" class="inline-flex">
    <button
      type="button"
      class="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      :class="isOpen ? 'bg-blue-50 text-blue-600' : ''"
      title="Automatismos"
      aria-label="Automatismos"
      :aria-expanded="isOpen"
      :disabled="isSubmitting"
      @click="toggleMenu"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M11.3 1.046A1 1 0 0 1 12 2v5h4a1 1 0 0 1 .82 1.573l-7 10A1 1 0 0 1 8 18v-5H4a1 1 0 0 1-.82-1.573l7-10a1 1 0 0 1 1.12-.381Z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuEl"
        class="fixed z-[1000] flex max-h-80 flex-col overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        :style="{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
          minWidth: `${menuPosition.minWidth}px`,
        }"
      >
        <div v-if="isLoading" class="px-3 py-2 text-xs text-gray-500">Cargando automatismos...</div>
        <div v-else-if="loadError" class="px-3 py-2 text-xs text-red-600">{{ loadError }}</div>
        <div v-else-if="rules.length === 0" class="px-3 py-2 text-xs text-gray-500">
          Sin automatismos para este ticket
        </div>
        <template v-else-if="selectedRule">
          <button
            type="button"
            class="px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50"
            @click="selectedRule = null"
          >
            ← {{ selectedRule.name }}
          </button>
          <form class="space-y-2 px-3 py-2" @submit.prevent="submitSelectedRule">
            <label
              v-for="input in selectedRule.inputs"
              :key="input.variableName"
              class="block text-xs text-gray-700"
            >
              <span class="mb-1 block font-medium">
                {{ input.displayName }}
                <span v-if="input.required" class="text-red-500">*</span>
              </span>
              <select
                v-if="input.inputType === 'DROPDOWN'"
                v-model="inputValues[input.variableName]"
                class="w-full rounded border border-gray-300 px-2 py-1 text-xs"
              >
                <option value="">Selecciona</option>
                <option v-for="option in input.options" :key="option" :value="option">
                  {{ option }}
                </option>
              </select>
              <select
                v-else-if="input.inputType === 'BOOLEAN'"
                v-model="inputValues[input.variableName]"
                class="w-full rounded border border-gray-300 px-2 py-1 text-xs"
              >
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
              <textarea
                v-else-if="input.inputType === 'PARAGRAPH'"
                v-model="inputValues[input.variableName]"
                rows="3"
                class="w-full rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <input
                v-else
                v-model="inputValues[input.variableName]"
                :type="input.inputType === 'NUMBER' ? 'number' : 'text'"
                class="w-full rounded border border-gray-300 px-2 py-1 text-xs"
              />
            </label>
            <button
              type="submit"
              class="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Lanzando...' : 'Lanzar' }}
            </button>
          </form>
        </template>
        <template v-else>
          <button
            v-for="rule in rules"
            :key="rule.id"
            type="button"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-60"
            :disabled="isSubmitting"
            @click="openRule(rule)"
          >
            <span
              class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-500"
              aria-hidden="true"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                <path
                  d="M3.105 3.105a1.5 1.5 0 0 1 1.64-.33l12 5.25a1.5 1.5 0 0 1 0 2.75l-12 5.25A1.5 1.5 0 0 1 2.5 14.9V11.6l7.2-1.6-7.2-1.6V5.1a1.5 1.5 0 0 1 .605-1.995Z"
                />
              </svg>
            </span>
            <span>{{ rule.name }}</span>
          </button>
        </template>
        <p v-if="submitError" class="px-3 py-1.5 text-xs text-red-600">{{ submitError }}</p>
        <p v-if="successMessage" class="px-3 py-1.5 text-xs text-emerald-700">{{ successMessage }}</p>
      </div>
    </Teleport>
  </div>
</template>

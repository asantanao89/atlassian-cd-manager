<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { jiraApi } from '../api/jiraApi'
import { issueStatusBadgeClass } from '../utils/issueStatus'
import type { JiraIssueTransition } from '../types/jira'

const props = defineProps<{
  issueKey: string
  statusName: string
}>()

const emit = defineEmits<{
  statusChanged: [payload: { issueKey: string; newStatusName: string }]
}>()

const rootEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const isLoading = ref(false)
const isSubmitting = ref(false)
const loadError = ref<string | null>(null)
const submitError = ref<string | null>(null)
const transitions = ref<JiraIssueTransition[]>([])
const visibleStatus = ref(props.statusName)
const menuPosition = ref({ top: 0, left: 0, minWidth: 176 })

watch(
  () => props.statusName,
  (next) => {
    if (!isSubmitting.value) visibleStatus.value = next
  },
)

const badgeClass = computed(() => issueStatusBadgeClass(visibleStatus.value))

function transitionStatusLabel(transition: JiraIssueTransition): string {
  return transition.toStatusName || transition.name
}

async function loadTransitions(): Promise<void> {
  isLoading.value = true
  loadError.value = null
  submitError.value = null
  try {
    const result = await jiraApi.getIssueTransitions(props.issueKey)
    transitions.value = result.transitions
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudieron cargar transiciones'
    transitions.value = []
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
  await nextTick()
  updateMenuPosition()
  if (transitions.value.length === 0 && !isLoading.value) {
    await loadTransitions()
  }
}

async function applyTransition(transition: JiraIssueTransition): Promise<void> {
  if (isSubmitting.value) return
  const previousStatus = visibleStatus.value
  visibleStatus.value = transition.toStatusName || transition.name
  submitError.value = null
  isSubmitting.value = true
  isOpen.value = false

  try {
    const result = await jiraApi.transitionIssue(props.issueKey, { transitionId: transition.id })
    const finalStatus = result.statusName || transition.toStatusName || transition.name
    visibleStatus.value = finalStatus
    emit('statusChanged', { issueKey: props.issueKey, newStatusName: finalStatus })
  } catch (error) {
    visibleStatus.value = previousStatus
    submitError.value = error instanceof Error ? error.message : 'No se pudo cambiar el estado'
  } finally {
    isSubmitting.value = false
  }
}

function onDocumentPointerDown(event: MouseEvent): void {
  if (!isOpen.value) return
  const target = event.target as Node | null
  if (!target) return
  const clickedInsideTrigger = rootEl.value?.contains(target) ?? false
  const clickedInsideMenu = menuEl.value?.contains(target) ?? false
  if (!clickedInsideTrigger && !clickedInsideMenu) {
    isOpen.value = false
  }
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    isOpen.value = false
  }
}

function updateMenuPosition(): void {
  if (!isOpen.value || !rootEl.value) return

  const triggerRect = rootEl.value.getBoundingClientRect()
  const menuRect = menuEl.value?.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const menuWidth = Math.max(menuRect?.width ?? 176, triggerRect.width)
  const menuHeight = menuRect?.height ?? 160
  const gap = 4
  const horizontalPadding = 8
  const verticalPadding = 8

  let left = triggerRect.left
  if (left + menuWidth > viewportWidth - horizontalPadding) {
    left = viewportWidth - horizontalPadding - menuWidth
  }
  if (left < horizontalPadding) left = horizontalPadding

  const spaceBelow = viewportHeight - triggerRect.bottom - verticalPadding
  const spaceAbove = triggerRect.top - verticalPadding
  const shouldOpenUp = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow
  let top = shouldOpenUp ? triggerRect.top - menuHeight - gap : triggerRect.bottom + gap

  if (top < verticalPadding) top = verticalPadding
  if (top + menuHeight > viewportHeight - verticalPadding) {
    top = Math.max(verticalPadding, viewportHeight - verticalPadding - menuHeight)
  }

  menuPosition.value = {
    top: Math.round(top),
    left: Math.round(left),
    minWidth: Math.round(Math.max(triggerRect.width, 176)),
  }
}

function onViewportChange(): void {
  updateMenuPosition()
}

watch(isOpen, async (open) => {
  if (!open) return
  await nextTick()
  updateMenuPosition()
})

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<template>
  <div ref="rootEl" class="relative inline-block text-left">
    <button
      type="button"
      class="text-xs px-1.5 py-0.5 rounded inline-flex items-center gap-1"
      :class="[badgeClass, isSubmitting ? 'opacity-70 cursor-wait' : 'cursor-pointer']"
      :disabled="isSubmitting"
      @click.stop="toggleMenu"
    >
      <span>{{ visibleStatus }}</span>
      <span class="text-[10px]">▾</span>
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuEl"
        class="fixed z-[1000] flex min-w-44 flex-col whitespace-normal rounded border border-gray-200 bg-white py-1 shadow-lg"
        :style="{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
          minWidth: `${menuPosition.minWidth}px`,
        }"
      >
        <div v-if="isLoading" class="px-3 py-2 text-xs text-gray-500">Cargando estados...</div>
        <div v-else-if="loadError" class="px-3 py-2 text-xs text-red-600">{{ loadError }}</div>
        <div v-else-if="transitions.length === 0" class="px-3 py-2 text-xs text-gray-500">
          Sin transiciones disponibles
        </div>
        <button
          v-for="transition in transitions"
          :key="transition.id"
          type="button"
          class="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
          :disabled="isSubmitting"
          @click.stop="applyTransition(transition)"
        >
          <span
            class="inline-flex rounded px-1.5 py-0.5 font-medium"
            :class="issueStatusBadgeClass(transitionStatusLabel(transition))"
          >
            {{ transitionStatusLabel(transition) }}
          </span>
        </button>
      </div>
    </Teleport>

    <p v-if="submitError" class="mt-1 text-[11px] text-red-600">{{ submitError }}</p>
  </div>
</template>

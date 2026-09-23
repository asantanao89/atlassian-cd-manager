<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import type { StoryCreateComponent } from '../types/jira'
import { labelTagClass } from '../utils/labelTag'

const props = defineProps<{
  issueKey: string
  components: string[]
}>()

const emit = defineEmits<{
  componentsChanged: [payload: { issueKey: string; components: string[] }]
}>()

const rootEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const visibleComponents = ref<string[]>([...props.components])
const selectedIds = ref<string[]>([])
const menuPosition = ref({ top: 0, left: 0, minWidth: 176 })

const {
  data: options,
  isLoading: isLoadingOptions,
  error: optionsError,
} = useQuery({
  queryKey: ['story-create-options'],
  queryFn: () => jiraApi.getStoryCreateOptions(),
  staleTime: 5 * 60 * 1000,
  enabled: computed(() => isOpen.value),
  retry: 1,
})

watch(
  () => props.components,
  (next) => {
    if (!isSubmitting.value) visibleComponents.value = [...next]
  },
)

const availableComponents = computed<StoryCreateComponent[]>(() => options.value?.components ?? [])

const loadError = computed(() => {
  if (!optionsError.value) return null
  return optionsError.value instanceof Error
    ? optionsError.value.message
    : 'No se pudieron cargar los components'
})

function namesToIds(names: string[], list: StoryCreateComponent[]): string[] {
  const byName = new Map(list.map((component) => [component.name.trim().toUpperCase(), component.id]))
  const ids: string[] = []
  for (const name of names) {
    const id = byName.get(name.trim().toUpperCase())
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

function idsToNames(ids: string[], list: StoryCreateComponent[]): string[] {
  const byId = new Map(list.map((component) => [component.id, component.name]))
  return ids
    .map((id) => byId.get(id)?.trim() ?? '')
    .filter(Boolean)
}

function syncSelectedIds(): void {
  selectedIds.value = namesToIds(visibleComponents.value, availableComponents.value)
}

watch(
  [isOpen, availableComponents],
  ([open, list]) => {
    if (open && list.length > 0 && !isSubmitting.value) syncSelectedIds()
  },
)

watch([isLoadingOptions, availableComponents], async () => {
  if (!isOpen.value) return
  await nextTick()
  updateMenuPosition()
})

function isSelected(id: string): boolean {
  return selectedIds.value.includes(id)
}

async function toggleMenu(): Promise<void> {
  if (isSubmitting.value) return
  if (isOpen.value) {
    isOpen.value = false
    return
  }
  submitError.value = null
  isOpen.value = true
  await nextTick()
  updateMenuPosition()
}

async function toggleComponent(id: string): Promise<void> {
  if (isSubmitting.value) return
  const nextIds = isSelected(id)
    ? selectedIds.value.filter((current) => current !== id)
    : [...selectedIds.value, id]
  if (nextIds.length === 0) {
    submitError.value = 'Selecciona al menos un component'
    return
  }

  const previousNames = [...visibleComponents.value]
  const previousIds = [...selectedIds.value]
  const optimisticNames = idsToNames(nextIds, availableComponents.value)
  selectedIds.value = nextIds
  visibleComponents.value = optimisticNames
  submitError.value = null
  isSubmitting.value = true

  try {
    const result = await jiraApi.updateIssueComponents(props.issueKey, { componentIds: nextIds })
    const finalNames = result.components.length > 0 ? result.components : optimisticNames
    visibleComponents.value = finalNames
    emit('componentsChanged', { issueKey: props.issueKey, components: finalNames })
  } catch (error) {
    selectedIds.value = previousIds
    visibleComponents.value = previousNames
    submitError.value = error instanceof Error ? error.message : 'No se pudo actualizar el component'
  } finally {
    isSubmitting.value = false
    await nextTick()
    updateMenuPosition()
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
      class="inline-flex max-w-full items-center gap-1 rounded text-left"
      :class="isSubmitting ? 'opacity-70 cursor-wait' : 'cursor-pointer'"
      :disabled="isSubmitting"
      :title="visibleComponents.length > 0 ? 'Editar components' : 'Asignar component'"
      :aria-label="visibleComponents.length > 0 ? 'Editar components' : 'Asignar component'"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      @click.stop="toggleMenu"
    >
      <span v-if="visibleComponents.length > 0" class="flex flex-wrap gap-1">
        <span
          v-for="component in visibleComponents"
          :key="component"
          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          :class="labelTagClass(component)"
        >
          {{ component }}
        </span>
      </span>
      <span v-else class="text-gray-400 text-sm">—</span>
      <span class="text-[10px] text-gray-400">▾</span>
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuEl"
        class="fixed z-[1000] flex min-w-44 flex-col whitespace-normal rounded border border-gray-200 bg-white py-1 shadow-lg"
        role="listbox"
        aria-multiselectable="true"
        :style="{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
          minWidth: `${menuPosition.minWidth}px`,
        }"
      >
        <div v-if="isLoadingOptions" class="px-3 py-2 text-xs text-gray-500">Cargando components...</div>
        <div v-else-if="loadError" class="px-3 py-2 text-xs text-red-600">{{ loadError }}</div>
        <div v-else-if="availableComponents.length === 0" class="px-3 py-2 text-xs text-gray-500">
          Sin components disponibles
        </div>
        <button
          v-for="component in availableComponents"
          :key="component.id"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-100"
          :disabled="isSubmitting"
          role="option"
          :aria-selected="isSelected(component.id)"
          @click.stop="toggleComponent(component.id)"
        >
          <span
            class="inline-flex h-3.5 w-3.5 items-center justify-center rounded border"
            :class="
              isSelected(component.id)
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-300 bg-white text-transparent'
            "
            aria-hidden="true"
          >
            <svg viewBox="0 0 12 12" fill="currentColor" class="h-2.5 w-2.5">
              <path
                d="M10.03 3.22a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 1.06-1.06L5 7.19l3.97-3.97a.75.75 0 0 1 1.06 0Z"
              />
            </svg>
          </span>
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 font-medium"
            :class="labelTagClass(component.name)"
          >
            {{ component.name }}
          </span>
        </button>
      </div>
    </Teleport>

    <p v-if="submitError" class="mt-1 text-[11px] text-red-600">{{ submitError }}</p>
  </div>
</template>

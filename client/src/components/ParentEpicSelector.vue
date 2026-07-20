<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { jiraApi } from '../api/jiraApi'
import { HttpError } from '../api/httpClient'
import WorkTypeIcon from './WorkTypeIcon.vue'
import type { StoryParentOption } from '../types/jira'

const props = defineProps<{
  modelValue: StoryParentOption | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: StoryParentOption | null]
}>()

const menuOpen = ref(false)
const includeDone = ref(false)
const hasLoadedOnce = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const parents = ref<StoryParentOption[]>([])

const selected = computed(() => props.modelValue)

function statusSwatchColor(parent: StoryParentOption): string {
  const key = parent.statusCategoryKey.toLowerCase()
  if (key === 'done') return '#36B37E'
  if (key === 'indeterminate') return '#FFAB00'
  if (key === 'new') return '#4C9AFF'
  const color = parent.statusColorName.toLowerCase()
  if (color.includes('green')) return '#36B37E'
  if (color.includes('yellow')) return '#FFAB00'
  if (color.includes('blue')) return '#4C9AFF'
  if (color.includes('red')) return '#FF5630'
  if (color.includes('purple')) return '#6554C0'
  return '#6B778C'
}

async function loadParents(): Promise<void> {
  isLoading.value = true
  errorMessage.value = null
  try {
    const result = await jiraApi.listStoryParents({ includeDone: includeDone.value })
    parents.value = result.parents
    hasLoadedOnce.value = true
  } catch (err) {
    errorMessage.value =
      err instanceof HttpError ? err.message : 'No se pudieron cargar las épicas.'
    parents.value = []
  } finally {
    isLoading.value = false
  }
}

async function openMenu(): Promise<void> {
  menuOpen.value = true
  if (!hasLoadedOnce.value) {
    await loadParents()
  }
}

function selectParent(parent: StoryParentOption): void {
  emit('update:modelValue', parent)
  menuOpen.value = false
}

function clearParent(): void {
  emit('update:modelValue', null)
  menuOpen.value = false
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (!target?.closest('[data-parent-menu]')) {
    menuOpen.value = false
  }
}

watch(includeDone, () => {
  if (menuOpen.value || hasLoadedOnce.value) {
    void loadParents()
  }
})

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div class="relative" data-parent-menu>
    <button
      type="button"
      class="w-full flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      :aria-expanded="menuOpen"
      @click.stop="menuOpen ? (menuOpen = false) : openMenu()"
    >
      <span v-if="selected" class="flex min-w-0 items-start gap-2 text-left">
        <WorkTypeIcon name="Epica" size="md" class="mt-0.5" />
        <span class="min-w-0">
          <span class="block font-mono text-xs text-gray-500">{{ selected.key }}</span>
          <span class="block truncate text-gray-800">{{ selected.summary }}</span>
        </span>
      </span>
      <span v-else class="text-gray-400">Select parent</span>
      <svg
        class="h-4 w-4 shrink-0 text-gray-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <div
      v-if="menuOpen"
      class="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
      role="listbox"
    >
      <label
        class="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2.5 text-sm text-gray-700"
      >
        <input
          v-model="includeDone"
          type="checkbox"
          class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Show everything marked as done
      </label>

      <div class="max-h-72 overflow-y-auto py-1">
        <div v-if="isLoading" class="px-3 py-3 text-sm text-gray-400">Cargando épicas…</div>
        <div v-else-if="errorMessage" class="px-3 py-3 text-sm text-red-600">
          {{ errorMessage }}
        </div>
        <template v-else>
          <button
            v-if="selected"
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
            @click="clearParent"
          >
            Clear selection
          </button>

          <button
            v-for="parent in parents"
            :key="parent.id"
            type="button"
            class="flex w-full items-start gap-2 border-l-2 border-transparent px-3 py-2 text-left hover:border-blue-500 hover:bg-gray-50"
            :class="{
              'border-blue-500 bg-gray-50': selected?.key === parent.key,
            }"
            role="option"
            :aria-selected="selected?.key === parent.key"
            @click="selectParent(parent)"
          >
            <span
              class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm"
              :style="{ backgroundColor: statusSwatchColor(parent) }"
              :title="parent.statusName"
            />
            <WorkTypeIcon name="Epica" size="md" class="mt-0.5" />
            <span class="min-w-0">
              <span class="block font-mono text-xs text-gray-500">{{ parent.key }}</span>
              <span class="block text-sm font-medium text-gray-900 break-words">
                {{ parent.summary }}
              </span>
            </span>
          </button>

          <div
            v-if="parents.length === 0"
            class="px-3 py-3 text-sm text-gray-400"
          >
            No hay épicas disponibles.
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

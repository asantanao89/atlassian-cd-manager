<script setup lang="ts">
import { PARENT_STATUS_NONE } from '../composables/useIssuesTableFilters'

defineProps<{
  keyStatusOptions: string[]
  parentStatusOptions: string[]
  hasIssuesWithoutParent: boolean
  hasActiveFilters: boolean
  filteredCount: number
  totalCount: number
}>()

const keyQuery = defineModel<string>('keyQuery', { required: true })
const statusKey = defineModel<string>('statusKey', { required: true })
const statusParent = defineModel<string>('statusParent', { required: true })

const emit = defineEmits<{
  clear: []
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
    <input
      v-model="keyQuery"
      type="search"
      placeholder="Buscar clave…"
      class="min-w-[8rem] flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      aria-label="Buscar por clave"
    />

    <select
      v-model="statusKey"
      class="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      aria-label="Filtrar por status de la key"
    >
      <option value="">Status key: todos</option>
      <option v-for="status in keyStatusOptions" :key="status" :value="status">
        {{ status }}
      </option>
    </select>

    <select
      v-model="statusParent"
      class="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      aria-label="Filtrar por status del parent"
    >
      <option value="">Status parent: todos</option>
      <option v-if="hasIssuesWithoutParent" :value="PARENT_STATUS_NONE">Sin parent</option>
      <option v-for="status in parentStatusOptions" :key="status" :value="status">
        {{ status }}
      </option>
    </select>

    <button
      v-if="hasActiveFilters"
      type="button"
      class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-white"
      @click="emit('clear')"
    >
      Limpiar
    </button>

    <span
      v-if="hasActiveFilters"
      class="ml-auto text-[11px] text-gray-500"
    >
      {{ filteredCount }} de {{ totalCount }}
    </span>
  </div>
</template>

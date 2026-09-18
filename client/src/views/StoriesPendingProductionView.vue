<script setup lang="ts">
import PendingProductionStoriesTable from '../components/PendingProductionStoriesTable.vue'
import { usePendingProductionStories } from '../composables/usePendingProductionStories'

const { stories, isLoading, errorMessage, refetch } = usePendingProductionStories()
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-800">Pendiente producción</h1>
      <button
        class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        @click="() => refetch()"
      >
        Actualizar
      </button>
    </div>

    <PendingProductionStoriesTable
      :stories="stories"
      :is-loading="isLoading"
      :error="errorMessage"
    />
  </div>
</template>

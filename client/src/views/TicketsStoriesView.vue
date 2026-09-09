<script setup lang="ts">
import ConnectionStatus from '../components/ConnectionStatus.vue'
import TicketStoriesTable from '../components/TicketStoriesTable.vue'
import { useCdtTicketStories } from '../composables/useCdtTicketStories'

const { stories, isLoading, errorMessage, refetch } = useCdtTicketStories()
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-800">Historias</h1>
      <div class="flex items-center gap-2">
        <button
          class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          @click="refetch"
        >
          Actualizar
        </button>
        <ConnectionStatus />
      </div>
    </div>

    <TicketStoriesTable
      :stories="stories"
      :is-loading="isLoading"
      :error="errorMessage"
    />
  </div>
</template>

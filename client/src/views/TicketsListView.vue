<script setup lang="ts">
import TicketsTable from '../components/TicketsTable.vue'
import { useCdtOpenTickets } from '../composables/useCdtOpenTickets'

const { tickets, isLoading, errorMessage, refetch } = useCdtOpenTickets()
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-800">Tickets</h1>
      <button
        class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        @click="() => refetch()"
      >
        Actualizar
      </button>
    </div>

    <TicketsTable
      :tickets="tickets ?? []"
      :is-loading="isLoading"
      :error="errorMessage"
    />
  </div>
</template>

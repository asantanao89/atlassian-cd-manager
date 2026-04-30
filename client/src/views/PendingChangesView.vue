<script setup lang="ts">
import PendingChangesPanel from '../components/PendingChangesPanel.vue'
import { usePendingChangesStore } from '../stores/pendingChanges.store'

const store = usePendingChangesStore()
</script>

<template>
  <div class="max-w-screen-xl mx-auto px-4 py-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-800">Cambios pendientes</h1>
      <span class="text-sm text-gray-500">
        {{ store.changes.filter((c) => c.status === 'draft').length }} en cola
      </span>
    </div>

    <div class="bg-white border border-gray-200 rounded-lg p-4">
      <PendingChangesPanel />
    </div>
  </div>
</template>

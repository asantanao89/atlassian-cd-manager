<script setup lang="ts">
import { useRoute } from 'vue-router'
import { usePendingChangesStore } from '../stores/pendingChanges.store'

const route = useRoute()
const pendingStore = usePendingChangesStore()
</script>

<template>
  <header class="bg-white border-b border-gray-200 shadow-sm">
    <div class="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <RouterLink to="/" class="text-lg font-semibold text-gray-900 hover:text-blue-600">
          Jira Time Tracking Manager
        </RouterLink>
      </div>

      <nav class="flex items-center gap-2">
        <RouterLink
          to="/"
          class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
          :class="route.name === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
        >
          Dashboard
        </RouterLink>
        <RouterLink
          to="/pending"
          class="px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5"
          :class="route.name === 'pending-changes' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
        >
          Cambios pendientes
          <span
            v-if="pendingStore.draftCount() > 0"
            class="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center"
          >
            {{ pendingStore.draftCount() }}
          </span>
        </RouterLink>
        <RouterLink
          to="/historic"
          class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
          :class="route.name === 'historic' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
        >
          Histórico
        </RouterLink>
      </nav>
    </div>
  </header>
</template>

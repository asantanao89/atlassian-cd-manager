<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePendingChangesStore } from '../stores/pendingChanges.store'

const route = useRoute()
const pendingStore = usePendingChangesStore()

const tabs = [
  { label: 'Resumen', to: '/timer/resumen' },
  { label: 'Worklogs Pendientes', to: '/timer/pendientes' },
  { label: 'Histórico', to: '/timer/historico' },
]

const currentPath = computed(() => route.path)
</script>

<template>
  <div class="max-w-screen-xl mx-auto px-4 py-6 space-y-4">
    <section class="bg-white border border-gray-200 rounded-lg p-2">
      <nav class="flex items-center gap-2 overflow-x-auto">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5"
          :class="currentPath.startsWith(tab.to) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
        >
          <span>{{ tab.label }}</span>
          <span
            v-if="tab.to === '/timer/pendientes' && pendingStore.draftCount() > 0"
            class="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center"
          >
            {{ pendingStore.draftCount() }}
          </span>
        </RouterLink>
      </nav>
    </section>

    <RouterView />
  </div>
</template>

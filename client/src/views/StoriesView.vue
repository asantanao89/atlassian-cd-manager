<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { label: 'Creación', to: '/stories/creacion' },
  { label: 'Pendiente producción', to: '/stories/pendiente-produccion' },
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
          class="px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap"
          :class="currentPath.startsWith(tab.to) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
        >
          {{ tab.label }}
        </RouterLink>
      </nav>
    </section>

    <RouterView />
  </div>
</template>

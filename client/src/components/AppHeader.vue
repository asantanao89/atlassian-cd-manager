<script setup lang="ts">
import { useRoute } from 'vue-router'
import ConnectionStatus from './ConnectionStatus.vue'

const route = useRoute()
</script>

<template>
  <header class="bg-white border-b border-gray-200 shadow-sm">
    <div class="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <RouterLink to="/timer" class="text-lg font-semibold text-gray-900 hover:text-blue-600 whitespace-nowrap shrink-0">
          Atlassian CD Manager
        </RouterLink>
      </div>

      <div class="flex items-center gap-2 min-w-0">
        <nav class="flex items-center gap-2 overflow-x-auto">
          <RouterLink
            to="/timer"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap"
            :class="route.path.startsWith('/timer') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
          >
            Tracking
          </RouterLink>
          <RouterLink
            to="/stories"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap"
            :class="route.path.startsWith('/stories') || route.path.startsWith('/create-story') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
          >
            Historias
          </RouterLink>
          <RouterLink
            to="/tickets"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap"
            :class="route.path.startsWith('/tickets') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
          >
            Tickets
          </RouterLink>
          <RouterLink
            to="/branch"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap"
            :class="route.path.startsWith('/branch') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
          >
            Branch
          </RouterLink>
          <RouterLink
            to="/pull-request"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap"
            :class="route.path.startsWith('/pull-request') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'"
          >
            Pull Request
          </RouterLink>
        </nav>
        <ConnectionStatus />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'

const {
  data: me,
  isLoading,
  isFetching,
  isError,
  refetch,
} = useQuery({
  queryKey: ['jira-me'],
  queryFn: () => jiraApi.getMe(),
  retry: false,
})

const { data: connectionInfo } = useQuery({
  queryKey: ['jira-connection-info'],
  queryFn: () => jiraApi.getConnectionInfo(),
  retry: false,
})

function handleRetry(): void {
  refetch()
}
</script>

<template>
  <div class="flex items-center gap-3 flex-wrap justify-end">
    <div v-if="isLoading" class="flex items-center gap-2 text-sm text-gray-500">
      <span class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
      Conectando con Jira...
    </div>

    <div v-else-if="isError" class="flex items-center gap-2 text-sm text-red-600">
      <span class="w-2 h-2 rounded-full bg-red-500" />
      Sin conexión con Jira
    </div>

    <div v-else-if="me" class="flex items-center gap-2 text-sm text-gray-700">
      <span class="w-2 h-2 rounded-full bg-green-500" />
      <span class="font-medium">{{ me.displayName }}</span>
      <span class="text-gray-400 text-xs">{{ me.emailAddress }}</span>
      <span class="text-gray-400 text-xs">{{ connectionInfo?.jiraBaseUrl }}</span>
    </div>

    <button
      class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
      :disabled="isFetching"
      @click="handleRetry"
    >
      {{ isFetching ? 'Probando...' : 'Probar conexión' }}
    </button>
  </div>
</template>

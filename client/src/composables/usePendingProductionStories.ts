import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import type { PendingProductionStory } from '../types/jira'

export function usePendingProductionStories() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pending-production-stories'],
    queryFn: () => jiraApi.listPendingProductionStories(),
    retry: 1,
  })

  const stories = computed<PendingProductionStory[]>(() => data.value?.stories ?? [])

  const errorMessage = computed(() => {
    if (!error.value) return null
    return error.value instanceof Error
      ? error.value.message
      : 'Error al cargar las historias pendientes de producción'
  })

  return {
    stories,
    isLoading,
    errorMessage,
    refetch,
  }
}

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

  const stories = computed<PendingProductionStory[]>(() =>
    [...(data.value?.stories ?? [])].sort((a, b) => {
      const aParent = a.parentKey?.trim() ?? ''
      const bParent = b.parentKey?.trim() ?? ''
      if (!aParent && bParent) return -1
      if (aParent && !bParent) return 1
      const byParent = aParent.localeCompare(bParent, 'es')
      if (byParent !== 0) return byParent
      return a.key.localeCompare(b.key, 'es')
    }),
  )

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

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import type { SprintStory } from '../types/jira'

export function useSprintStories() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sprint-stories'],
    queryFn: () => jiraApi.listSprintStories(),
    retry: 1,
  })

  const stories = computed<SprintStory[]>(() => data.value?.stories ?? [])
  const sprintName = computed(() => data.value?.sprintName ?? null)

  const errorMessage = computed(() => {
    if (!error.value) return null
    return error.value instanceof Error
      ? error.value.message
      : 'Error al cargar las historias del sprint'
  })

  return {
    stories,
    sprintName,
    isLoading,
    errorMessage,
    refetch,
  }
}

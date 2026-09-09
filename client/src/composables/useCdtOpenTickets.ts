import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'

export function useCdtOpenTickets() {
  const {
    data: tickets,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['cdt-open-tickets'],
    queryFn: async () => {
      const result = await jiraApi.listCdtTickets()
      return result.tickets
    },
    retry: 1,
  })

  const errorMessage = computed(() => {
    if (!error.value) return null
    return error.value instanceof Error ? error.value.message : 'Error al cargar los tickets abiertos'
  })

  return {
    tickets,
    isLoading,
    errorMessage,
    refetch,
  }
}

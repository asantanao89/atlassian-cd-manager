import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import type { CdtTicketStory } from '../types/jira'
import { useCdtOpenTickets } from './useCdtOpenTickets'

type FetchedStory = Omit<CdtTicketStory, 'ticketKeys'>

async function fetchStoriesByKeys(keys: string[]): Promise<CdtTicketStory[]> {
  const uniqueKeys = [...new Set(keys.filter(Boolean))]
  if (uniqueKeys.length === 0) return []

  const byKey = new Map<string, FetchedStory>()
  let nextPageToken: string | null = null
  const jql = `key in (${uniqueKeys.join(',')}) ORDER BY updated DESC`

  do {
    const result = await jiraApi.searchIssues({
      jql,
      maxResults: 100,
      nextPageToken,
    })
    for (const issue of result.issues) {
      byKey.set(issue.key, {
        key: issue.key,
        summary: issue.summary,
        statusName: issue.statusName,
        created: issue.created ?? '',
        sprintName: issue.sprintName ?? '',
        components: issue.components ?? [],
      })
    }
    nextPageToken = result.nextPageToken
  } while (nextPageToken)

  return uniqueKeys
    .map((key) => byKey.get(key))
    .filter((issue): issue is FetchedStory => issue != null)
    .map((issue) => ({ ...issue, ticketKeys: [] }))
}

export function useCdtTicketStories() {
  const { tickets, isLoading: ticketsLoading, errorMessage: ticketsError, refetch: refetchTickets } =
    useCdtOpenTickets()

  const ticketKeysByStory = computed(() => {
    const map = new Map<string, string[]>()
    for (const ticket of tickets.value ?? []) {
      const storyKey = ticket.linkedKey.trim()
      if (!storyKey) continue
      const list = map.get(storyKey) ?? []
      list.push(ticket.key)
      map.set(storyKey, list)
    }
    return map
  })

  const storyKeys = computed(() => [...ticketKeysByStory.value.keys()])
  const storyKeysKey = computed(() => [...storyKeys.value].sort().join(','))

  const {
    data: fetchedStories,
    isLoading: storiesLoading,
    error: storiesError,
    refetch: refetchStories,
  } = useQuery({
    queryKey: ['cdt-ticket-stories', 'created', storyKeysKey],
    queryFn: () => fetchStoriesByKeys(storyKeys.value),
    enabled: computed(() => !ticketsLoading.value && storyKeys.value.length > 0),
    retry: 1,
  })

  const stories = computed<CdtTicketStory[]>(() => {
    const keysByStory = ticketKeysByStory.value
    return (fetchedStories.value ?? []).map((story) => ({
      ...story,
      ticketKeys: keysByStory.get(story.key) ?? [],
    }))
  })

  const isLoading = computed(
    () => ticketsLoading.value || (storyKeys.value.length > 0 && storiesLoading.value),
  )

  const errorMessage = computed(() => {
    if (ticketsError.value) return ticketsError.value
    if (!storiesError.value) return null
    return storiesError.value instanceof Error
      ? storiesError.value.message
      : 'Error al cargar las historias enlazadas'
  })

  function refetch(): void {
    void refetchTickets()
    if (storyKeys.value.length > 0) void refetchStories()
  }

  return {
    stories,
    isLoading,
    errorMessage,
    refetch,
  }
}

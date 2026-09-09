import { computed, ref, watch, type MaybeRefOrGetter, toValue } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import type { CdtTicket } from '../types/jira'

function matchesQuery(value: string, query: string): boolean {
  if (!query) return true
  return value.toLowerCase().includes(query)
}

function matchesRequestType(value: string, query: string): boolean {
  if (!query) return true
  const normalizedValue = value.toLowerCase()
  const normalizedQuery = query.toLowerCase()
  if (normalizedValue.includes(normalizedQuery)) return true
  return normalizedQuery === 'incidencia' && normalizedValue === 'incident'
}

function ticketCreatedInRange(iso: string, from: string, to: string): boolean {
  if (!from && !to) return true
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return false
  if (from && time < new Date(`${from}T00:00:00`).getTime()) return false
  if (to && time > new Date(`${to}T23:59:59.999`).getTime()) return false
  return true
}

function firstQueryValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}

function optionsWithSelected(values: string[], selected: string): string[] {
  const names = uniqueSorted(values.map((value) => value.trim()).filter(Boolean))
  const current = selected.trim()
  if (current && !names.some((name) => name.toLowerCase() === current.toLowerCase())) {
    return [current, ...names]
  }
  return names
}

function matchesStatus(value: string, query: string): boolean {
  if (!query) return true
  return value.trim().toLowerCase() === query
}

function compactQuery(query: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value.length > 0))
}

function serializeQuery(query: LocationQuery | Record<string, string>): string {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    const text = firstQueryValue(value).trim()
    if (text) normalized[key] = text
  }
  return Object.keys(normalized)
    .sort()
    .map((key) => `${key}=${normalized[key]}`)
    .join('&')
}

export function formatCreatedAt(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

export function useTicketsTableFilters(ticketsSource: MaybeRefOrGetter<CdtTicket[]>) {
  const route = useRoute()
  const router = useRouter()

  const keyQuery = ref('')
  const linkedKeyQuery = ref('')
  const requestTypeQuery = ref('')
  const statusQuery = ref('')
  const assigneeQuery = ref('')
  const createdFrom = ref('')
  const createdTo = ref('')
  const noStory = ref(false)
  const assignedOnly = ref(false)
  const unassignedOnly = ref(false)

  const tickets = computed(() => toValue(ticketsSource))

  const requestTypeOptions = computed(() =>
    optionsWithSelected(
      tickets.value.map((ticket) => ticket.requestType),
      requestTypeQuery.value,
    ),
  )

  const statusOptions = computed(() =>
    optionsWithSelected(
      tickets.value.map((ticket) => ticket.statusName),
      statusQuery.value,
    ),
  )

  function applyRouteQuery(): void {
    const query = route.query
    keyQuery.value = firstQueryValue(query.key)
    linkedKeyQuery.value = firstQueryValue(query.story)
    requestTypeQuery.value = firstQueryValue(query.requestType)
    statusQuery.value = firstQueryValue(query.status)
    assigneeQuery.value = firstQueryValue(query.assignee)
    createdFrom.value = firstQueryValue(query.from)
    createdTo.value = firstQueryValue(query.to)
    noStory.value = firstQueryValue(query.noStory) === '1'
    assignedOnly.value = firstQueryValue(query.assigned) === '1'
    unassignedOnly.value = firstQueryValue(query.unassigned) === '1'
  }

  function currentQuery(): Record<string, string> {
    return compactQuery({
      key: keyQuery.value.trim(),
      story: linkedKeyQuery.value.trim(),
      requestType: requestTypeQuery.value.trim(),
      status: statusQuery.value.trim(),
      assignee: assigneeQuery.value.trim(),
      from: createdFrom.value,
      to: createdTo.value,
      noStory: noStory.value ? '1' : '',
      assigned: assignedOnly.value ? '1' : '',
      unassigned: unassignedOnly.value ? '1' : '',
    })
  }

  watch(() => route.query, applyRouteQuery, { immediate: true })

  watch(
    [keyQuery, linkedKeyQuery, requestTypeQuery, statusQuery, assigneeQuery, createdFrom, createdTo, noStory, assignedOnly, unassignedOnly],
    () => {
      const nextQuery = currentQuery()
      if (serializeQuery(nextQuery) === serializeQuery(route.query)) return
      void router.replace({ query: nextQuery })
    },
  )

  const filteredTickets = computed(() => {
    const key = keyQuery.value.trim().toLowerCase()
    const linkedKey = linkedKeyQuery.value.trim().toLowerCase()
    const requestType = requestTypeQuery.value.trim()
    const status = statusQuery.value.trim().toLowerCase()
    const assignee = assigneeQuery.value.trim().toLowerCase()
    const from = createdFrom.value
    const to = createdTo.value
    const withoutStory = noStory.value
    const onlyAssigned = assignedOnly.value
    const onlyUnassigned = unassignedOnly.value

    return tickets.value.filter(
      (ticket) =>
        matchesQuery(ticket.key, key)
        && matchesQuery(ticket.linkedKey, linkedKey)
        && matchesRequestType(ticket.requestType, requestType)
        && matchesStatus(ticket.statusName, status)
        && matchesQuery(ticket.assigneeName, assignee)
        && ticketCreatedInRange(ticket.created, from, to)
        && (!withoutStory || !ticket.linkedKey.trim())
        && (!onlyAssigned || ticket.assigneeName.trim().length > 0)
        && (!onlyUnassigned || !ticket.assigneeName.trim()),
    )
  })

  const hasActiveFilters = computed(
    () =>
      keyQuery.value.trim().length > 0
      || linkedKeyQuery.value.trim().length > 0
      || requestTypeQuery.value.trim().length > 0
      || statusQuery.value.trim().length > 0
      || assigneeQuery.value.trim().length > 0
      || createdFrom.value.length > 0
      || createdTo.value.length > 0
      || noStory.value
      || assignedOnly.value
      || unassignedOnly.value,
  )

  function clearFilters(): void {
    keyQuery.value = ''
    linkedKeyQuery.value = ''
    requestTypeQuery.value = ''
    statusQuery.value = ''
    assigneeQuery.value = ''
    createdFrom.value = ''
    createdTo.value = ''
    noStory.value = false
    assignedOnly.value = false
    unassignedOnly.value = false
  }

  function matchesExactQuery(expected: Record<string, string>): boolean {
    return serializeQuery(currentQuery()) === serializeQuery(compactQuery(expected))
  }

  const isUngestionedActive = computed(() => matchesExactQuery({ noStory: '1', unassigned: '1' }))

  function isMyTicketsPreset(displayName: string): boolean {
    const mine = displayName.trim()
    if (!mine) return false
    return matchesExactQuery({ assignee: mine })
  }

  function applyUngestioned(): void {
    const wasActive = isUngestionedActive.value
    clearFilters()
    if (wasActive) return
    noStory.value = true
    unassignedOnly.value = true
  }

  function applyMyTickets(displayName: string): void {
    const mine = displayName.trim()
    if (!mine) return
    const wasActive = isMyTicketsPreset(mine)
    clearFilters()
    if (wasActive) return
    assigneeQuery.value = mine
  }

  return {
    keyQuery,
    linkedKeyQuery,
    requestTypeQuery,
    requestTypeOptions,
    statusQuery,
    statusOptions,
    assigneeQuery,
    createdFrom,
    createdTo,
    noStory,
    assignedOnly,
    unassignedOnly,
    filteredTickets,
    hasActiveFilters,
    clearFilters,
    isUngestionedActive,
    isMyTicketsPreset,
    applyUngestioned,
    applyMyTickets,
    totalCount: computed(() => tickets.value.length),
    filteredCount: computed(() => filteredTickets.value.length),
  }
}

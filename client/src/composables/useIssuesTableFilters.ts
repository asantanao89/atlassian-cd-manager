import { computed, ref, type MaybeRefOrGetter, toValue } from 'vue'
import type { JiraIssueSummary } from '../types/jira'

/** Sentinel value for filtering issues that have no parent. */
export const PARENT_STATUS_NONE = '__none__'

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}

export function useIssuesTableFilters(issuesSource: MaybeRefOrGetter<JiraIssueSummary[]>) {
  const keyQuery = ref('')
  const statusKey = ref('')
  const statusParent = ref('')

  const issues = computed(() => toValue(issuesSource))

  const keyStatusOptions = computed(() =>
    uniqueSorted(issues.value.map((issue) => issue.statusName).filter(Boolean)),
  )

  const parentStatusOptions = computed(() =>
    uniqueSorted(
      issues.value
        .map((issue) => issue.parentStatusName)
        .filter((name): name is string => typeof name === 'string' && name.trim().length > 0),
    ),
  )

  const hasIssuesWithoutParent = computed(() =>
    issues.value.some((issue) => !issue.parentKey),
  )

  const filteredIssues = computed(() => {
    const query = keyQuery.value.trim().toLowerCase()
    const keyStatus = statusKey.value
    const parentStatus = statusParent.value

    return issues.value.filter((issue) => {
      if (query) {
        const keyMatch = issue.key.toLowerCase().includes(query)
        const parentKeyMatch = issue.parentKey?.toLowerCase().includes(query) ?? false
        if (!keyMatch && !parentKeyMatch) return false
      }

      if (keyStatus && issue.statusName !== keyStatus) return false

      if (parentStatus === PARENT_STATUS_NONE) {
        if (issue.parentKey) return false
      } else if (parentStatus) {
        if (issue.parentStatusName !== parentStatus) return false
      }

      return true
    })
  })

  const hasActiveFilters = computed(
    () =>
      keyQuery.value.trim().length > 0
      || statusKey.value.length > 0
      || statusParent.value.length > 0,
  )

  function clearFilters(): void {
    keyQuery.value = ''
    statusKey.value = ''
    statusParent.value = ''
  }

  return {
    keyQuery,
    statusKey,
    statusParent,
    keyStatusOptions,
    parentStatusOptions,
    hasIssuesWithoutParent,
    filteredIssues,
    hasActiveFilters,
    clearFilters,
    totalCount: computed(() => issues.value.length),
    filteredCount: computed(() => filteredIssues.value.length),
  }
}

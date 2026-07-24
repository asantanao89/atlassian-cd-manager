import { computed, type Ref, toValue } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'

export interface WorklogPoint {
  issueKey: string
  summary: string
  parentSummary: string | null
  started: string
  timeSpentSeconds: number
  authorDisplayName: string
}

function formatJqlDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function useMonthlyWorklogs(year: Ref<number> | number, month: Ref<number> | number) {
  const { data: me } = useQuery({
    queryKey: ['jira-me'],
    queryFn: () => jiraApi.getMe(),
    retry: false,
  })

  const currentDisplayName = computed(() => me.value?.displayName?.trim().toLowerCase() ?? '')

  return useQuery({
    queryKey: computed(() => ['monthly-worklogs', toValue(year), toValue(month), currentDisplayName.value]),
    queryFn: async (): Promise<WorklogPoint[]> => {
      const y = toValue(year)
      const m = toValue(month)
      const monthStart = new Date(y, m, 1)
      const monthEnd = new Date(y, m + 1, 0)

      const issueSearch = await jiraApi.searchIssuesWithWorklogs({
        jql: `worklogAuthor = currentUser() AND worklogDate >= ${formatJqlDate(monthStart)} AND worklogDate <= ${formatJqlDate(monthEnd)}`,
        maxResults: 100,
      })


      return issueSearch.issues.flatMap((issue) =>
        issue.worklogs
          .filter(
            (worklog) =>
              worklog.authorDisplayName.trim().toLowerCase() === currentDisplayName.value,
          )
          .map((worklog) => ({
            issueKey: issue.key,
            summary: issue.summary,
            parentSummary: issue.parentSummary,
            started: worklog.started,
            timeSpentSeconds: worklog.timeSpentSeconds,
            authorDisplayName: worklog.authorDisplayName,
          })),
      )
    },
    enabled: computed(() => currentDisplayName.value.length > 0),
    staleTime: 30_000,
    retry: 1,
  })
}

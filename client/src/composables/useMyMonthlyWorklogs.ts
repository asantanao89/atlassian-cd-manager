import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'

export interface WorklogPoint {
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

export function useMyMonthlyWorklogs() {
  const { data: me } = useQuery({
    queryKey: ['jira-me'],
    queryFn: () => jiraApi.getMe(),
    retry: false,
  })

  const currentDisplayName = computed(() => me.value?.displayName?.trim().toLowerCase() ?? '')
  const worklogStartDate = computed(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  return useQuery({
    queryKey: ['my-monthly-worklogs', currentDisplayName, worklogStartDate],
    queryFn: async (): Promise<WorklogPoint[]> => {
      const issueSearch = await jiraApi.searchIssuesWithWorklogs({
        jql: `worklogAuthor = currentUser() AND worklogDate >= ${formatJqlDate(worklogStartDate.value)} ORDER BY updated DESC`,
        maxResults: 50,
      })

      const allWorklogs = issueSearch.issues.flatMap((issue) => issue.worklogs)

      return allWorklogs
        .filter(
          (worklog) =>
            worklog.authorDisplayName.trim().toLowerCase() === currentDisplayName.value,
        )
        .map((worklog) => ({
          started: worklog.started,
          timeSpentSeconds: worklog.timeSpentSeconds,
          authorDisplayName: worklog.authorDisplayName,
        }))
    },
    enabled: computed(() => currentDisplayName.value.length > 0),
    staleTime: 30_000,
    retry: 1,
  })
}

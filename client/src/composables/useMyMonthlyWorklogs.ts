import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'

export interface WorklogPoint {
  started: string
  timeSpentSeconds: number
  authorDisplayName: string
}

function startOfCurrentWeek(date: Date): Date {
  const day = date.getDay() === 0 ? 7 : date.getDay()
  const mondayOffset = day - 1
  const start = new Date(date)
  start.setDate(date.getDate() - mondayOffset)
  start.setHours(0, 0, 0, 0)
  return start
}

function startOfCurrentSprint(date: Date): Date {
  const currentWeekStart = startOfCurrentWeek(date)
  const firstDayOfYear = new Date(currentWeekStart.getFullYear(), 0, 1)
  const firstDayWeekday = firstDayOfYear.getDay() === 0 ? 7 : firstDayOfYear.getDay()
  const firstMonday = new Date(firstDayOfYear)
  firstMonday.setDate(firstDayOfYear.getDate() - (firstDayWeekday - 1))
  firstMonday.setHours(0, 0, 0, 0)

  const diffMs = currentWeekStart.getTime() - firstMonday.getTime()
  const weekIndex = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  const sprintWeekIndex = weekIndex % 2 === 0 ? weekIndex : weekIndex - 1

  const sprintStart = new Date(firstMonday)
  sprintStart.setDate(firstMonday.getDate() + sprintWeekIndex * 7)
  return sprintStart
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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const sprintStart = startOfCurrentSprint(now)
    return sprintStart < monthStart ? sprintStart : monthStart
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

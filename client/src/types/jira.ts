export type JiraIssueType = 'Story' | 'Sub-task' | string

export interface JiraUser {
  accountId: string
  displayName: string
  emailAddress?: string
  active: boolean
}

export interface JiraConnectionInfo {
  jiraBaseUrl: string
}

export interface JiraTimeTracking {
  originalEstimate?: string
  remainingEstimate?: string
  timeSpent?: string
  originalEstimateSeconds?: number
  remainingEstimateSeconds?: number
  timeSpentSeconds?: number
}

export interface JiraIssueSummary {
  id: string
  key: string
  summary: string
  issueType: JiraIssueType
  statusName: string
  assigneeName: string | null
  parentKey: string | null
  parentSummary: string | null
  updated: string
  timetracking: JiraTimeTracking
  subtaskKeys: string[]
}

export interface JiraIssueWithWorklogs extends JiraIssueSummary {
  worklogs: JiraWorklog[]
}

export interface JiraWorklog {
  id: string
  issueId: string
  authorDisplayName: string
  updateAuthorDisplayName: string
  started: string
  updated: string
  timeSpent: string
  timeSpentSeconds: number
  commentText: string
}

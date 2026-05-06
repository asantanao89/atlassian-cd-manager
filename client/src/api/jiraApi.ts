import { httpClient } from './httpClient'
import type {
  JiraConnectionInfo,
  JiraIssueSummary,
  JiraIssueWithWorklogs,
  JiraOpenPullRequest,
  JiraUser,
  JiraWorklog,
} from '../types/jira'

export interface SearchIssuesParams {
  jql: string
  maxResults?: number
  nextPageToken?: string | null
  includeWorklogs?: boolean
}

export interface SearchIssuesResponse {
  issues: JiraIssueSummary[]
  total: number
  nextPageToken: string | null
}

export interface SearchIssuesWithWorklogsResponse {
  issues: JiraIssueWithWorklogs[]
  total: number
  nextPageToken: string | null
}

export interface WorklogListResponse {
  worklogs: JiraWorklog[]
  total: number
}

export interface CreateWorklogParams {
  timeSpent: string
  started: string
  comment?: string
  adjustEstimate?: 'auto' | 'leave' | 'new' | 'manual'
  newEstimate?: string
  increaseBy?: string
}

export const jiraApi = {
  getConnectionInfo: (): Promise<JiraConnectionInfo> =>
    httpClient.get<JiraConnectionInfo>('/api/jira/connection-info'),

  getMe: (): Promise<JiraUser> => httpClient.get<JiraUser>('/api/jira/me'),

  searchIssues: (params: SearchIssuesParams): Promise<SearchIssuesResponse> =>
    httpClient.post<SearchIssuesResponse>('/api/jira/issues/search', {
      jql: params.jql,
      maxResults: params.maxResults ?? 50,
      nextPageToken: params.nextPageToken ?? null,
      includeWorklogs: params.includeWorklogs ?? false,
    }),

  searchIssuesWithWorklogs: (
    params: SearchIssuesParams,
  ): Promise<SearchIssuesWithWorklogsResponse> =>
    httpClient.post<SearchIssuesWithWorklogsResponse>('/api/jira/issues/search', {
      jql: params.jql,
      maxResults: params.maxResults ?? 50,
      nextPageToken: params.nextPageToken ?? null,
      includeWorklogs: true,
    }),

  getIssue: (issueKey: string): Promise<JiraIssueSummary> =>
    httpClient.get<JiraIssueSummary>(`/api/jira/issues/${encodeURIComponent(issueKey)}`),

  getOpenPullRequestsForParent: (parentKey: string): Promise<{ pullRequests: JiraOpenPullRequest[] }> =>
    httpClient.get<{ pullRequests: JiraOpenPullRequest[] }>(
      `/api/jira/issues/${encodeURIComponent(parentKey)}/open-pull-requests`,
    ),

  getWorklogs: (issueKey: string): Promise<WorklogListResponse> =>
    httpClient.get<WorklogListResponse>(
      `/api/jira/issues/${encodeURIComponent(issueKey)}/worklogs`,
    ),

  createWorklog: (issueKey: string, params: CreateWorklogParams): Promise<JiraWorklog> =>
    httpClient.post<JiraWorklog>(
      `/api/jira/issues/${encodeURIComponent(issueKey)}/worklogs`,
      params,
    ),

  updateWorklog: (
    issueKey: string,
    worklogId: string,
    params: CreateWorklogParams,
  ): Promise<JiraWorklog> =>
    httpClient.put<JiraWorklog>(
      `/api/jira/issues/${encodeURIComponent(issueKey)}/worklogs/${worklogId}`,
      params,
    ),

  deleteWorklog: (issueKey: string, worklogId: string): Promise<void> =>
    httpClient.delete<void>(
      `/api/jira/issues/${encodeURIComponent(issueKey)}/worklogs/${worklogId}`,
    ),
}

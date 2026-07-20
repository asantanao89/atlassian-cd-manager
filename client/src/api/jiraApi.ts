import { httpClient } from './httpClient'
import type {
  CreatePullRequestParams,
  CreatedPullRequest,
  CreateStoryParams,
  CreatedStory,
  UpdateStoryParams,
  StoryEditorIssue,
  JiraConnectionInfo,
  JiraIssueSummary,
  JiraIssueWithWorklogs,
  JiraOpenPullRequest,
  JiraIssueTransitionsResponse,
  UpdateIssueStatusParams,
  PullRequestBranchList,
  JiraUser,
  JiraWorklog,
  StoryCreateOptions,
  StoryParentOption,
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

  getIssueTransitions: (issueKey: string): Promise<JiraIssueTransitionsResponse> =>
    httpClient.get<JiraIssueTransitionsResponse>(
      `/api/jira/issues/${encodeURIComponent(issueKey)}/transitions`,
    ),

  transitionIssue: (
    issueKey: string,
    params: UpdateIssueStatusParams,
  ): Promise<{ success: true; statusName: string }> =>
    httpClient.post<{ success: true; statusName: string }>(
      `/api/jira/issues/${encodeURIComponent(issueKey)}/transitions`,
      params,
    ),

  getPullRequestBranches: (): Promise<PullRequestBranchList> =>
    httpClient.get<PullRequestBranchList>('/api/bitbucket/pull-requests/branches'),

  createPullRequest: (params: CreatePullRequestParams): Promise<CreatedPullRequest> =>
    httpClient.post<CreatedPullRequest>('/api/bitbucket/pull-requests', params),

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

  getStoryCreateOptions: (): Promise<StoryCreateOptions> =>
    httpClient.get<StoryCreateOptions>('/api/jira/stories/create-options'),

  listStoryParents: (params?: {
    includeDone?: boolean
    q?: string
  }): Promise<{ parents: StoryParentOption[] }> => {
    const search = new URLSearchParams()
    if (params?.includeDone) search.set('includeDone', 'true')
    if (params?.q?.trim()) search.set('q', params.q.trim())
    const qs = search.toString()
    return httpClient.get<{ parents: StoryParentOption[] }>(
      `/api/jira/stories/parents${qs ? `?${qs}` : ''}`,
    )
  },

  createStory: (params: CreateStoryParams): Promise<CreatedStory> =>
    httpClient.post<CreatedStory>('/api/jira/stories', params),

  getStoryForEdit: (issueKeyOrUrl: string): Promise<StoryEditorIssue> =>
    httpClient.get<StoryEditorIssue>(
      `/api/jira/stories/${encodeURIComponent(issueKeyOrUrl.trim())}`,
    ),

  updateStory: (issueKey: string, params: UpdateStoryParams): Promise<CreatedStory> =>
    httpClient.put<CreatedStory>(
      `/api/jira/stories/${encodeURIComponent(issueKey)}`,
      params,
    ),
}

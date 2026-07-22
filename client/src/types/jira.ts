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
  parentStatusName: string | null
  updated: string
  timetracking: JiraTimeTracking
  subtaskKeys: string[]
}

export interface JiraIssueWithWorklogs extends JiraIssueSummary {
  worklogs: JiraWorklog[]
}

export interface JiraOpenPullRequest {
  id: string
  title: string
  url: string | null
  state: string | null
  sourceBranch: string | null
  targetBranch: string | null
  repository: string | null
  author: string | null
}

export interface JiraIssueTransition {
  id: string
  name: string
  toStatusName: string
}

export interface JiraIssueTransitionsResponse {
  transitions: JiraIssueTransition[]
}

export interface UpdateIssueStatusParams {
  transitionId: string
}

export interface PullRequestBranchList {
  repoSlug: string
  branches: string[]
}

export interface CreatePullRequestParams {
  repoSlug: string
  sourceBranch: string
  targetBranch: string
  title: string
  description?: string
}

export interface CreatedPullRequest {
  id: string
  title: string
  url: string | null
  state: string | null
  sourceBranch: string | null
  targetBranch: string | null
  repository: string | null
  author: string | null
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

export interface StoryCreateComponent {
  id: string
  name: string
}

export interface StoryCreateIssueType {
  id: string
  name: string
  iconUrl: string | null
}

export interface StoryCreatePilarOption {
  id: string
  value: string
}

export interface StoryCreateOptions {
  projectKey: string
  projectName: string
  defaultIssueTypeId: string
  epicIssueTypeId: string
  unOptionValue: string
  issueTypes: StoryCreateIssueType[]
  components: StoryCreateComponent[]
  pilares: StoryCreatePilarOption[]
}

export interface StoryParentOption {
  id: string
  key: string
  summary: string
  statusName: string
  statusCategoryKey: string
  statusColorName: string
}

export interface CreateStoryParams {
  summary: string
  issueTypeId: string
  componentIds: string[]
  valor: string
  description?: string
  parentKey?: string | null
  pilarId?: string | null
  storyPoints?: number | null
  acceptanceCriteria?: string | null
}

/** Snapshot values (at form load) for fields to back up as a Jira comment on update. */
export interface StoryFieldBackup {
  summary?: string
  description?: string
  acceptanceCriteria?: string
}

export interface UpdateStoryParams extends CreateStoryParams {
  fieldBackup?: StoryFieldBackup
}

export interface StoryEditorIssue {
  id: string
  key: string
  url: string | null
  statusName: string
  summary: string
  description: string
  issueTypeId: string
  issueTypeName: string
  componentIds: string[]
  valor: string
  parentKey: string | null
  parentSummary: string | null
  pilarId: string | null
  pilarValue: string | null
  storyPoints: number | null
  acceptanceCriteria: string
}

export interface CreatedStory {
  id: string
  key: string
  url: string | null
}

export type PendingChangeType =
  | 'create-worklog'
  | 'update-worklog'
  | 'delete-worklog'

export type PendingChangeStatus = 'draft' | 'running' | 'success' | 'error'

export interface PendingChange {
  id: string
  issueKey: string
  issueSummary?: string
  type: PendingChangeType
  before: unknown
  after: unknown
  status: PendingChangeStatus
  errorMessage?: string
}

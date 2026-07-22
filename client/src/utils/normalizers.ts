import type { JiraIssueSummary, JiraWorklog } from '../types/jira'

/**
 * Ensures a value from the server response is a proper JiraIssueSummary.
 * Since normalization happens server-side, this is a defensive guard.
 */
export function normalizeIssueResponse(raw: Partial<JiraIssueSummary>): JiraIssueSummary {
  return {
    id: raw.id ?? '',
    key: raw.key ?? '',
    summary: raw.summary ?? '',
    issueType: raw.issueType ?? '',
    statusName: raw.statusName ?? '',
    assigneeName: raw.assigneeName ?? null,
    parentKey: raw.parentKey ?? null,
    parentSummary: raw.parentSummary ?? null,
    parentStatusName: raw.parentStatusName ?? null,
    updated: raw.updated ?? '',
    timetracking: raw.timetracking ?? {},
    subtaskKeys: raw.subtaskKeys ?? [],
  }
}

/**
 * Ensures a value from the server response is a proper JiraWorklog.
 */
export function normalizeWorklogResponse(raw: Partial<JiraWorklog>): JiraWorklog {
  return {
    id: raw.id ?? '',
    issueId: raw.issueId ?? '',
    authorDisplayName: raw.authorDisplayName ?? 'Desconocido',
    updateAuthorDisplayName: raw.updateAuthorDisplayName ?? 'Desconocido',
    started: raw.started ?? '',
    updated: raw.updated ?? '',
    timeSpent: raw.timeSpent ?? '0m',
    timeSpentSeconds: raw.timeSpentSeconds ?? 0,
    commentText: raw.commentText ?? '',
  }
}

import { describe, it, expect } from 'vitest'
import { normalizeIssueResponse, normalizeWorklogResponse } from '../utils/normalizers'

describe('normalizeIssueResponse', () => {
  it('normalizes an issue with full timetracking', () => {
    const issue = normalizeIssueResponse({
      id: '10001',
      key: 'ABC-1',
      summary: 'Test issue',
      issueType: 'Story',
      statusName: 'In Progress',
      assigneeName: 'John Doe',
      parentKey: null,
      parentSummary: null,
      parentStatusName: null,
      updated: '2026-04-29T10:00:00.000Z',
      timetracking: {
        originalEstimate: '4h',
        remainingEstimate: '2h',
        timeSpent: '2h',
        originalEstimateSeconds: 14400,
        remainingEstimateSeconds: 7200,
        timeSpentSeconds: 7200,
      },
      subtaskKeys: [],
    })

    expect(issue.id).toBe('10001')
    expect(issue.key).toBe('ABC-1')
    expect(issue.timetracking.originalEstimate).toBe('4h')
    expect(issue.timetracking.timeSpent).toBe('2h')
  })

  it('normalizes an issue without assignee', () => {
    const issue = normalizeIssueResponse({
      id: '10002',
      key: 'ABC-2',
      summary: 'Unassigned issue',
      assigneeName: null,
    })

    expect(issue.assigneeName).toBeNull()
  })

  it('normalizes an issue without timetracking (uses defaults)', () => {
    const issue = normalizeIssueResponse({
      id: '10003',
      key: 'ABC-3',
      summary: 'No time tracking',
    })

    expect(issue.timetracking).toEqual({})
    expect(issue.timetracking.originalEstimate).toBeUndefined()
    expect(issue.timetracking.timeSpent).toBeUndefined()
  })

  it('normalizes subtask keys', () => {
    const issue = normalizeIssueResponse({
      key: 'ABC-4',
      subtaskKeys: ['ABC-5', 'ABC-6'],
    })

    expect(issue.subtaskKeys).toEqual(['ABC-5', 'ABC-6'])
  })

  it('provides defaults for missing fields', () => {
    const issue = normalizeIssueResponse({})
    expect(issue.id).toBe('')
    expect(issue.key).toBe('')
    expect(issue.summary).toBe('')
    expect(issue.assigneeName).toBeNull()
    expect(issue.parentKey).toBeNull()
    expect(issue.parentSummary).toBeNull()
    expect(issue.parentStatusName).toBeNull()
    expect(issue.subtaskKeys).toEqual([])
  })
})

describe('normalizeWorklogResponse', () => {
  it('normalizes a worklog with a comment', () => {
    const worklog = normalizeWorklogResponse({
      id: 'wl-1',
      issueId: 'ABC-1',
      authorDisplayName: 'Jane Doe',
      updateAuthorDisplayName: 'Jane Doe',
      started: '2026-04-29T09:00:00.000+0000',
      updated: '2026-04-29T09:30:00.000+0000',
      timeSpent: '1h',
      timeSpentSeconds: 3600,
      commentText: 'Trabajo realizado',
    })

    expect(worklog.id).toBe('wl-1')
    expect(worklog.timeSpent).toBe('1h')
    expect(worklog.commentText).toBe('Trabajo realizado')
    expect(worklog.authorDisplayName).toBe('Jane Doe')
  })

  it('normalizes a worklog without a comment', () => {
    const worklog = normalizeWorklogResponse({
      id: 'wl-2',
      timeSpent: '30m',
      timeSpentSeconds: 1800,
    })

    expect(worklog.commentText).toBe('')
  })

  it('provides defaults for missing fields', () => {
    const worklog = normalizeWorklogResponse({})
    expect(worklog.id).toBe('')
    expect(worklog.issueId).toBe('')
    expect(worklog.authorDisplayName).toBe('Desconocido')
    expect(worklog.timeSpent).toBe('0m')
    expect(worklog.timeSpentSeconds).toBe(0)
  })
})

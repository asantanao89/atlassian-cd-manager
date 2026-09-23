import { describe, expect, it } from 'vitest'
import { parseJiraIssueKey } from '../utils/parseIssueKey'

describe('parseJiraIssueKey', () => {
  it('parses a raw issue key', () => {
    expect(parseJiraIssueKey('CDPM-23237')).toBe('CDPM-23237')
  })

  it('parses a browse URL', () => {
    expect(parseJiraIssueKey('https://proclinic.atlassian.net/browse/CDPM-23237')).toBe('CDPM-23237')
  })

  it('extracts an embedded key from a branch name', () => {
    expect(parseJiraIssueKey('feature/CDPM-23237-solentum-blog-entry-september-2026')).toBe(
      'CDPM-23237',
    )
  })

  it('extracts an embedded key from a PR title', () => {
    expect(parseJiraIssueKey('CDPM-23237 :: feat: create solentum blog entry')).toBe('CDPM-23237')
  })

  it('returns null when there is no issue key', () => {
    expect(parseJiraIssueKey('develop')).toBeNull()
    expect(parseJiraIssueKey('')).toBeNull()
  })
})

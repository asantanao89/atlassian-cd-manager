import { describe, expect, it } from 'vitest'
import { normalizeIssue } from './jiraNormalizer'

describe('normalizeIssue', () => {
  it('maps component names and skips empty ones', () => {
    const issue = normalizeIssue({
      id: '10001',
      key: 'CDPM-1',
      fields: {
        summary: 'Story',
        components: [{ id: '10185', name: 'WEB' }, { id: '10082', name: '  ' }, { name: 'iOS' }, null],
      },
    })

    expect(issue.components).toEqual(['WEB', 'iOS'])
  })

  it('defaults components to an empty array', () => {
    const issue = normalizeIssue({
      id: '10002',
      key: 'CDPM-2',
      fields: { summary: 'No components' },
    })

    expect(issue.components).toEqual([])
  })
})

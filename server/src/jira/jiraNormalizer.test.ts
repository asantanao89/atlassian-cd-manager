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

  it('defaults components and labels to empty arrays', () => {
    const issue = normalizeIssue({
      id: '10002',
      key: 'CDPM-2',
      fields: { summary: 'No components' },
    })

    expect(issue.components).toEqual([])
    expect(issue.labels).toEqual([])
  })

  it('maps labels', () => {
    const issue = normalizeIssue({
      id: '10003',
      key: 'CDPM-3',
      fields: { summary: 'Story', labels: ['pim', '  ', 'proshop'] },
    })

    expect(issue.labels).toEqual(['pim', 'proshop'])
  })

  it('maps nested parent status color from Jira', () => {
    const issue = normalizeIssue({
      id: '10004',
      key: 'CDPM-4',
      fields: {
        summary: 'Story',
        parent: {
          key: 'CDPM-22349',
          fields: {
            summary: 'Scraper 2.0',
            status: {
              name: 'Listo Producción',
              statusCategory: { key: 'done', colorName: 'green' },
            },
            issuetype: { name: 'Epica' },
          },
        },
      },
    })

    expect(issue.parentKey).toBe('CDPM-22349')
    expect(issue.parentSummary).toBe('Scraper 2.0')
    expect(issue.parentStatusName).toBe('Listo Producción')
    expect(issue.parentStatusCategoryKey).toBe('done')
    expect(issue.parentStatusColorName).toBe('green')
    expect(issue.parentIssueType).toBe('Epica')
  })
})

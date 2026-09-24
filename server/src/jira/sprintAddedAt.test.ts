import { describe, expect, it } from 'vitest'
import { sprintAddedAt } from './sprintAddedAt'

const created = '2026-01-05T09:00:00.000Z'

describe('sprintAddedAt', () => {
  it('uses the first time the story enters a sprint', () => {
    expect(
      sprintAddedAt(created, [
        {
          created: '2026-02-02T08:00:00.000Z',
          items: [{ field: 'Sprint', fieldId: 'customfield_10020', from: null, to: '10' }],
        },
        {
          created: '2026-03-02T08:00:00.000Z',
          items: [{ field: 'Sprint', fieldId: 'customfield_10020', from: '10', to: '10, 11' }],
        },
      ]),
    ).toBe('2026-02-02T08:00:00.000Z')
  })

  it('keeps the original entry when the story moves from one sprint to the next', () => {
    expect(
      sprintAddedAt(created, [
        {
          created: '2026-01-06T08:00:00.000Z',
          items: [{ fieldId: 'customfield_10020', from: null, to: '1' }],
        },
        {
          created: '2026-01-20T08:00:00.000Z',
          items: [{ fieldId: 'customfield_10020', from: '1', to: '2' }],
        },
        {
          created: '2026-02-03T08:00:00.000Z',
          items: [{ fieldId: 'customfield_10020', from: '2', to: '3' }],
        },
      ]),
    ).toBe('2026-01-06T08:00:00.000Z')
  })

  it('falls back to creation when the story was already in a sprint before the first change', () => {
    expect(
      sprintAddedAt(created, [
        {
          created: '2026-02-01T08:00:00.000Z',
          items: [{ field: 'Sprint', from: '1', to: '1, 2' }],
        },
      ]),
    ).toBe(created)
  })

  it('falls back to creation when there is no sprint history', () => {
    expect(sprintAddedAt(created, [])).toBe(created)
  })
})

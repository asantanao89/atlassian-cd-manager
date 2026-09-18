import { describe, expect, it } from 'vitest'
import {
  developmentStateBadgeClass,
  groupPullRequestStates,
  groupPullRequestsByRepository,
} from '../utils/developmentStatus'
import type { JiraOpenPullRequest } from '../types/jira'

function pr(id: string, state: string, url: string | null = null): JiraOpenPullRequest {
  return {
    id,
    title: id,
    url,
    state,
    sourceBranch: null,
    targetBranch: null,
    repository: null,
    author: null,
  }
}

describe('groupPullRequestStates', () => {
  it('groups by state and maps Jira OPEN to Under review', () => {
    const groups = groupPullRequestStates([
      pr('1', 'OPEN', 'https://example/1'),
      pr('2', 'MERGED'),
      pr('3', 'open'),
    ])

    expect(groups).toEqual([
      { state: 'OPEN', label: 'Under review', count: 2, url: 'https://example/1' },
      { state: 'MERGED', label: 'Merged', count: 1, url: null },
    ])
  })
})

describe('groupPullRequestsByRepository', () => {
  it('groups pull requests by repository using the URL when the field is missing', () => {
    const groups = groupPullRequestsByRepository([
      {
        ...pr('2299', 'OPEN', 'https://bitbucket.org/proclinic/proshop/pull-requests/2299'),
        title: 'Feature/CDPM-1',
      },
      {
        ...pr('12', 'MERGED', 'https://bitbucket.org/proclinic/hobbits/pull-requests/12'),
        title: 'Fix/CDPM-1',
      },
      {
        ...pr('13', 'OPEN', 'https://bitbucket.org/proclinic/proshop/pull-requests/13'),
        repository: 'proclinic/proshop',
      },
    ])

    expect(groups.map((group) => group.name)).toEqual(['proclinic/hobbits', 'proclinic/proshop'])
    expect(groups[0]?.provider).toBe('Bitbucket Cloud')
    expect(groups[1]?.pullRequests).toHaveLength(2)
  })

  it('ignores Bitbucket UUID repository names and uses the slug from the URL', () => {
    const groups = groupPullRequestsByRepository([
      {
        ...pr(
          '2615',
          'MERGED',
          'https://bitbucket.org/proclinic/proshop/pull-requests/2615',
        ),
        repository: '{8878dad2-5b91-4a1f-97e0-de0af2575a62}/{0f263927-45ed-42fd-8052-9cf2f907daab}',
      },
      {
        ...pr(
          '330',
          'MERGED',
          'https://bitbucket.org/proclinic/hobbits/pull-requests/330',
        ),
        repository: '{8878dad2-5b91-4a1f-97e0-de0af2575a62}/{b9e898ed-c343-4763-839d-935d4823f161}',
      },
    ])

    expect(groups.map((group) => group.name)).toEqual(['proclinic/hobbits', 'proclinic/proshop'])
    expect(groups.map((group) => group.url)).toEqual([
      'https://bitbucket.org/proclinic/hobbits',
      'https://bitbucket.org/proclinic/proshop',
    ])
  })

  it('uses a human repository slug even when the PR URL contains Bitbucket UUIDs', () => {
    const groups = groupPullRequestsByRepository([
      {
        ...pr(
          '2615',
          'MERGED',
          'https://bitbucket.org/{8878dad2-5b91-4a1f-97e0-de0af2575a62}/{0f263927-45ed-42fd-8052-9cf2f907daab}/pull-requests/2615',
        ),
        repository: 'proclinic/proshop',
      },
    ])

    expect(groups[0]?.name).toBe('proclinic/proshop')
    expect(groups[0]?.url).toBe('https://bitbucket.org/proclinic/proshop')
  })
})

describe('developmentStateBadgeClass', () => {
  it('uses blue for open and green for merged', () => {
    expect(developmentStateBadgeClass('OPEN')).toContain('bg-blue-100')
    expect(developmentStateBadgeClass('MERGED')).toContain('bg-green-100')
  })
})

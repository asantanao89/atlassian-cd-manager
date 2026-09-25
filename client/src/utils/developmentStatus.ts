import type { JiraOpenPullRequest } from '../types/jira'

export interface DevelopmentStateGroup {
  state: string
  label: string
  count: number
  url: string | null
}

function developmentStateLabel(state: string): string {
  const value = state.trim().toUpperCase()
  if (value === 'OPEN') return 'Under review'
  if (value === 'DRAFT') return 'Draft'
  if (value === 'MERGED') return 'Merged'
  if (value === 'DECLINED') return 'Declined'
  if (value === 'SUPERSEDED') return 'Superseded'
  return state.trim() || 'Unknown'
}

export function developmentStateBadgeClass(state: string): string {
  const value = state.trim().toUpperCase()
  if (value === 'OPEN') return 'bg-blue-100 text-blue-800'
  if (value === 'DRAFT') return 'bg-gray-100 text-gray-700'
  if (value === 'MERGED') return 'bg-green-100 text-green-800'
  if (value === 'DECLINED') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-700'
}

const STATE_ORDER = ['OPEN', 'DRAFT', 'MERGED', 'DECLINED', 'SUPERSEDED']

export function groupPullRequestStates(pullRequests: JiraOpenPullRequest[]): DevelopmentStateGroup[] {
  const groups = new Map<string, DevelopmentStateGroup>()

  for (const pullRequest of pullRequests) {
    const state = (pullRequest.state ?? 'OPEN').trim().toUpperCase() || 'OPEN'
    const existing = groups.get(state)
    if (existing) {
      existing.count += 1
      if (!existing.url && pullRequest.url) existing.url = pullRequest.url
      continue
    }
    groups.set(state, {
      state,
      label: developmentStateLabel(state),
      count: 1,
      url: pullRequest.url,
    })
  }

  return [...groups.values()].sort((a, b) => {
    const aIndex = STATE_ORDER.indexOf(a.state)
    const bIndex = STATE_ORDER.indexOf(b.state)
    const aRank = aIndex === -1 ? STATE_ORDER.length : aIndex
    const bRank = bIndex === -1 ? STATE_ORDER.length : bIndex
    return aRank - bRank || a.label.localeCompare(b.label, 'es')
  })
}

export interface PullRequestRepositoryGroup {
  name: string
  provider: string | null
  url: string | null
  pullRequests: JiraOpenPullRequest[]
}

function decodeRepoPath(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function repositoryFromUrl(url: string): string | null {
  const match = url.match(/(?:bitbucket\.org|github\.com|gitlab\.com)\/([^/]+\/[^/]+)/i)
  return match ? decodeRepoPath(match[1]) : null
}

function isMachineRepositoryName(name: string): boolean {
  const decoded = decodeRepoPath(name)
  return /\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}/i.test(decoded)
}

function humanRepositoryName(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (value && !isMachineRepositoryName(value)) return value
  }
  return null
}

function repositoryProvider(url: string): string | null {
  if (/bitbucket\.org/i.test(url)) return 'Bitbucket Cloud'
  if (/github\.com/i.test(url)) return 'GitHub'
  if (/gitlab\.com/i.test(url)) return 'GitLab'
  return null
}

function repositoryHomeUrl(url: string, name: string): string | null {
  if (name && !isMachineRepositoryName(name)) {
    if (/bitbucket\.org/i.test(url)) return `https://bitbucket.org/${name}`
    if (/github\.com/i.test(url)) return `https://github.com/${name}`
    if (/gitlab\.com/i.test(url)) return `https://gitlab.com/${name}`
  }
  const match = url.match(/^(https?:\/\/(?:bitbucket\.org|github\.com|gitlab\.com)\/[^/]+\/[^/]+)/i)
  if (match && !isMachineRepositoryName(match[1])) return match[1]
  return match ? match[1] : null
}

export function groupPullRequestsByRepository(
  pullRequests: JiraOpenPullRequest[],
): PullRequestRepositoryGroup[] {
  const groups = new Map<string, PullRequestRepositoryGroup>()

  for (const pullRequest of pullRequests) {
    const url = pullRequest.url ?? ''
    const name =
      humanRepositoryName(pullRequest.repository, repositoryFromUrl(url)) ||
      pullRequest.repository?.trim() ||
      repositoryFromUrl(url) ||
      'Otros repositorios'
    const provider = repositoryProvider(url)
    const key = `${name}::${provider ?? ''}`
    const existing = groups.get(key)
    if (existing) {
      existing.pullRequests.push(pullRequest)
      if (!existing.url) existing.url = repositoryHomeUrl(url, name)
      continue
    }
    groups.set(key, {
      name,
      provider,
      url: repositoryHomeUrl(url, name),
      pullRequests: [pullRequest],
    })
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

import { httpClient } from './httpClient'

export interface BitbucketReposResponse {
  repos: string[]
}

export interface BitbucketBranchesResponse {
  branches: string[]
}

export interface BitbucketCreateBranchParams {
  repoSlug: string
  name: string
  startPoint: string
}

export interface BitbucketCreateBranchResponse {
  branch: string
}

export interface BitbucketCommitsResponse {
  commits: { hash: string; message: string }[]
}

export const bitbucketApi = {
  getRepos: (): Promise<BitbucketReposResponse> =>
    httpClient.get<BitbucketReposResponse>('/api/bitbucket/repos'),

  getBranches: (repoSlug: string, q?: string): Promise<BitbucketBranchesResponse> => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : ''
    return httpClient.get<BitbucketBranchesResponse>(
      `/api/bitbucket/repos/${encodeURIComponent(repoSlug)}/branches${qs}`,
    )
  },

  getCommits: (repoSlug: string, source: string, target: string): Promise<BitbucketCommitsResponse> =>
    httpClient.get<BitbucketCommitsResponse>(
      `/api/bitbucket/repos/${encodeURIComponent(repoSlug)}/commits?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`,
    ),

  createBranch: (params: BitbucketCreateBranchParams): Promise<BitbucketCreateBranchResponse> =>
    httpClient.post<BitbucketCreateBranchResponse>(
      `/api/bitbucket/repos/${encodeURIComponent(params.repoSlug)}/branches`,
      { name: params.name, startPoint: params.startPoint },
    ),

  createPullRequest: (params: {
    repoSlug: string
    sourceBranch: string
    targetBranch: string
    title: string
    description?: string
  }): Promise<import('../types/jira').CreatedPullRequest> =>
    httpClient.post<import('../types/jira').CreatedPullRequest>(
      '/api/bitbucket/pull-requests',
      params,
    ),
}

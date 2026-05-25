import { getEnv } from '../env'
import { mapBitbucketError, type BitbucketApiError } from './bitbucketErrors'

export type RequestResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: BitbucketApiError }

export interface BitbucketBranch {
  name: string
  target: { hash: string }
}

export interface BitbucketBranchListResponse {
  values: BitbucketBranch[]
  next?: string
}

export interface BitbucketPullRequest {
  id: number
  title: string
  state: string
  source: { branch: { name: string }; repository?: { full_name: string } }
  destination: { branch: { name: string } }
  author: { display_name: string } | null
  links: { html: { href: string } }
}

export interface BitbucketPullRequestListResponse {
  values: BitbucketPullRequest[]
  next?: string
}

class BitbucketClient {
  private readonly baseUrl: string
  private readonly authHeader: string
  private readonly workspace: string

  constructor() {
    const env = getEnv()
    this.baseUrl = (env.BITBUCKET_BASE_URL ?? 'https://api.bitbucket.org/2.0').replace(/\/$/, '')
    this.workspace = env.BITBUCKET_WORKSPACE ?? ''
    // Basic Auth: user:token → base64
    const user = env.BITBUCKET_API_USER ?? ''
    const token = env.BITBUCKET_API_TOKEN ?? ''
    this.authHeader = `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  private networkError(): RequestResult<never> {
    return {
      ok: false,
      error: {
        statusCode: 503,
        message: 'No se pudo conectar con Bitbucket. Verifica la conexión de red.',
      },
    }
  }

  getWorkspace(): string {
    return this.workspace
  }

  async get<T>(path: string): Promise<RequestResult<T>> {
    try {
      const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
      })
      const data = (await response.json()) as unknown
      if (!response.ok) return { ok: false, error: mapBitbucketError(response.status, data) }
      return { ok: true, data: data as T, status: response.status }
    } catch {
      return this.networkError()
    }
  }

  async post<T>(path: string, body: unknown): Promise<RequestResult<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      })
      const data = (await response.json()) as unknown
      if (!response.ok) return { ok: false, error: mapBitbucketError(response.status, data) }
      return { ok: true, data: data as T, status: response.status }
    } catch {
      return this.networkError()
    }
  }

  // --- Domain methods ---

  /**
   * List all branches for a repo, auto-paginating up to 500.
   */
  async listBranches(repoSlug: string, query?: string): Promise<string[]> {
    const branches: string[] = []
    const qs = query ? `&q=name ~ "${query}"` : ''
    let url: string | null =
      `/repositories/${this.workspace}/${repoSlug}/refs/branches?pagelen=100${qs}`

    while (url && branches.length < 500) {
      const result: RequestResult<BitbucketBranchListResponse> = await this.get<BitbucketBranchListResponse>(url)
      if (!result.ok) throw result.error
      for (const b of result.data.values) {
        branches.push(b.name)
      }
      url = result.data.next ?? null
    }

    return branches
  }

  /**
   * Resolve a branch name to its HEAD commit hash.
   */
  async resolveBranchHash(repoSlug: string, branchName: string): Promise<string> {
    const path = `/repositories/${this.workspace}/${repoSlug}/refs/branches/${encodeURIComponent(branchName)}`
    const result = await this.get<BitbucketBranch>(path)
    if (!result.ok) throw result.error
    return result.data.target.hash
  }

  /**
   * Create a branch via the Bitbucket API.
   * Requires resolving the startPoint branch name to a hash first.
   */
  async createBranch(repoSlug: string, name: string, startPoint: string): Promise<BitbucketBranch> {
    const hash = await this.resolveBranchHash(repoSlug, startPoint)
    const path = `/repositories/${this.workspace}/${repoSlug}/refs/branches`
    const result = await this.post<BitbucketBranch>(path, { name, target: { hash } })
    if (!result.ok) throw result.error
    return result.data
  }

  /**
   * Create a pull request via the Bitbucket API.
   */
  async createPullRequest(
    repoSlug: string,
    params: { title: string; sourceBranch: string; targetBranch: string; description?: string },
  ): Promise<BitbucketPullRequest> {
    const path = `/repositories/${this.workspace}/${repoSlug}/pullrequests`
    const body = {
      title: params.title,
      source: { branch: { name: params.sourceBranch } },
      destination: { branch: { name: params.targetBranch } },
      ...(params.description ? { description: params.description } : {}),
    }
    const result = await this.post<BitbucketPullRequest>(path, body)
    if (!result.ok) throw result.error
    return result.data
  }

  /**
   * List commits between source and target branches (commits in source not in target).
   */
  async listCommits(
    repoSlug: string,
    sourceBranch: string,
    targetBranch: string,
  ): Promise<{ message: string; hash: string }[]> {
    const commits: { message: string; hash: string }[] = []
    const include = encodeURIComponent(sourceBranch)
    const exclude = encodeURIComponent(targetBranch)
    let url: string | null =
      `/repositories/${this.workspace}/${repoSlug}/commits?include=${include}&exclude=${exclude}&pagelen=50`

    while (url && commits.length < 100) {
      const result: RequestResult<{ values: { hash: string; message: string }[]; next?: string }> =
        await this.get(url)
      if (!result.ok) throw result.error
      for (const c of result.data.values) {
        commits.push({ hash: c.hash.slice(0, 7), message: c.message.split('\n')[0] })
      }
      url = result.data.next ?? null
    }

    return commits
  }
}

let _client: BitbucketClient | null = null

export function getBitbucketClient(): BitbucketClient {
  if (!_client) _client = new BitbucketClient()
  return _client
}

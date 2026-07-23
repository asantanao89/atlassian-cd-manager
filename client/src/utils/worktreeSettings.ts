export type WorktreeIde = 'cursor' | 'vscode'

export interface WorktreeSettings {
  repoSlug: string
  ide: WorktreeIde
}

/** Fixed parent folder where worktrees live (`../repo-CDPM-XXX` from the clone). */
export const WORKTREE_BASE_PATH = '/Users/asantana/Documents/projects'

const STORAGE_KEY = 'jira-utilities:worktree-settings'

const DEFAULT_SETTINGS: WorktreeSettings = {
  repoSlug: '',
  ide: 'vscode',
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isWorktreeIde(value: unknown): value is WorktreeIde {
  return value === 'cursor' || value === 'vscode'
}

export function loadWorktreeSettings(): WorktreeSettings {
  if (!canUseStorage()) return { ...DEFAULT_SETTINGS }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }

    const parsed = JSON.parse(raw) as Partial<WorktreeSettings> & { basePath?: string }
    return {
      repoSlug: typeof parsed.repoSlug === 'string' ? parsed.repoSlug : '',
      ide: isWorktreeIde(parsed.ide) ? parsed.ide : 'vscode',
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveWorktreeSettings(settings: WorktreeSettings): void {
  if (!canUseStorage()) return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage write errors without breaking the app.
  }
}

export function buildWorktreeFolderPath(repoSlug: string, issueKey: string): string | null {
  const repo = repoSlug.trim()
  const key = issueKey.trim()
  if (!repo || !key) return null
  return `${WORKTREE_BASE_PATH}/${repo}-${key}`
}

export function isWorktreeSettingsReady(settings: Pick<WorktreeSettings, 'repoSlug'>): boolean {
  return settings.repoSlug.trim().length > 0
}

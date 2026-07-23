export type WorktreeIde = 'cursor' | 'vscode'
export type WorktreeOpenTarget = 'worktree' | 'project'

export interface WorktreeSettings {
  repoSlug: string
  ide: WorktreeIde
  openTarget: WorktreeOpenTarget
}

/** Fixed parent folder where worktrees and project clones live. */
export const WORKTREE_BASE_PATH = '/Users/asantana/Documents/projects'

const STORAGE_KEY = 'jira-utilities:worktree-settings'

const DEFAULT_SETTINGS: WorktreeSettings = {
  repoSlug: '',
  ide: 'vscode',
  openTarget: 'worktree',
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isWorktreeIde(value: unknown): value is WorktreeIde {
  return value === 'cursor' || value === 'vscode'
}

function isWorktreeOpenTarget(value: unknown): value is WorktreeOpenTarget {
  return value === 'worktree' || value === 'project'
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
      openTarget: isWorktreeOpenTarget(parsed.openTarget) ? parsed.openTarget : 'worktree',
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

export function buildProjectFolderPath(repoSlug: string): string | null {
  const repo = repoSlug.trim()
  if (!repo) return null
  return `${WORKTREE_BASE_PATH}/${repo}`
}

export function buildOpenFolderPath(
  openTarget: WorktreeOpenTarget,
  repoSlug: string,
  issueKey: string,
): string | null {
  return openTarget === 'project'
    ? buildProjectFolderPath(repoSlug)
    : buildWorktreeFolderPath(repoSlug, issueKey)
}

export function isWorktreeSettingsReady(settings: Pick<WorktreeSettings, 'repoSlug'>): boolean {
  return settings.repoSlug.trim().length > 0
}

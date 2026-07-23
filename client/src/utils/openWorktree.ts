import type { WorktreeIde } from './worktreeSettings'

/**
 * Deep-link URLs for opening a local folder in Cursor / VS Code.
 * Absolute POSIX paths like `/Users/...` become `cursor://file/Users/...`.
 */
export function buildWorktreeOpenUrl(absolutePath: string, ide: WorktreeIde): string {
  const normalized = absolutePath.trim()
  if (!normalized.startsWith('/')) {
    throw new Error('Worktree path must be an absolute path starting with /')
  }

  const scheme = ide === 'vscode' ? 'vscode' : 'cursor'
  return `${scheme}://file${normalized}`
}

export function openWorktreeInIde(absolutePath: string, ide: WorktreeIde): void {
  const url = buildWorktreeOpenUrl(absolutePath, ide)
  window.location.href = url
}

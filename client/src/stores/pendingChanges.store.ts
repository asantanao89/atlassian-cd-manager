import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { PendingChange, PendingChangeType } from '../types/pendingChange'
import { jiraApi } from '../api/jiraApi'
import type { CreateWorklogParams } from '../api/jiraApi'

const PENDING_CHANGES_STORAGE_KEY = 'jira-utilities:pending-changes'

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function normalizeHydratedChange(change: PendingChange): PendingChange {
  return {
    ...change,
    // If the page reloads during execution, allow retry by reverting running to draft.
    status: change.status === 'running' ? 'draft' : change.status,
  }
}

function loadChangesFromStorage(): PendingChange[] {
  if (!canUseStorage()) return []

  try {
    const raw = window.localStorage.getItem(PENDING_CHANGES_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is PendingChange => {
        if (!item || typeof item !== 'object') return false
        const candidate = item as Partial<PendingChange>
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.issueKey === 'string' &&
          typeof candidate.type === 'string' &&
          typeof candidate.status === 'string'
        )
      })
      .map(normalizeHydratedChange)
  } catch {
    return []
  }
}

function saveChangesToStorage(changes: PendingChange[]): void {
  if (!canUseStorage()) return

  try {
    window.localStorage.setItem(PENDING_CHANGES_STORAGE_KEY, JSON.stringify(changes))
  } catch {
    // Ignore storage write errors (quota/private mode) without breaking the app.
  }
}

export const usePendingChangesStore = defineStore('pendingChanges', () => {
  const changes = ref<PendingChange[]>(loadChangesFromStorage())
  const isExecuting = ref(false)

  watch(
    changes,
    (value) => {
      saveChangesToStorage(value)
    },
    { deep: true },
  )

  function addChange(
    issueKey: string,
    type: PendingChangeType,
    before: unknown,
    after: unknown,
    issueSummary?: string,
  ): PendingChange {
    const change: PendingChange = {
      id: crypto.randomUUID(),
      issueKey,
      issueSummary,
      type,
      before,
      after,
      status: 'draft',
    }
    changes.value.push(change)
    return change
  }

  function removeChange(id: string): void {
    changes.value = changes.value.filter((c) => c.id !== id)
  }

  function clearCompleted(): void {
    changes.value = changes.value.filter((c) => c.status !== 'success')
  }

  async function executeChange(change: PendingChange): Promise<void> {
    switch (change.type) {
      case 'create-worklog': {
        const params = change.after as CreateWorklogParams
        await jiraApi.createWorklog(change.issueKey, params)
        break
      }
      case 'update-worklog': {
        const { worklogId, ...params } = change.after as CreateWorklogParams & { worklogId: string }
        await jiraApi.updateWorklog(change.issueKey, worklogId, params)
        break
      }
      case 'delete-worklog': {
        const { worklogId } = change.after as { worklogId: string }
        await jiraApi.deleteWorklog(change.issueKey, worklogId)
        break
      }
    }
  }

  async function executeAll(): Promise<void> {
    if (isExecuting.value) return
    isExecuting.value = true

    const drafts = changes.value.filter((c) => c.status === 'draft')
    for (const change of drafts) {
      change.status = 'running'
      try {
        await executeChange(change)
        change.status = 'success'
      } catch (err) {
        change.status = 'error'
        change.errorMessage = err instanceof Error ? err.message : 'Error desconocido'
        // Continue with remaining changes even if one fails
      }
    }

    isExecuting.value = false
  }

  async function executeSingle(changeId: string): Promise<void> {
    if (isExecuting.value) return
    const change = changes.value.find((c) => c.id === changeId)
    if (!change) return

    isExecuting.value = true
    change.status = 'running'
    try {
      await executeChange(change)
      change.status = 'success'
    } catch (err) {
      change.status = 'error'
      change.errorMessage = err instanceof Error ? err.message : 'Error desconocido'
    } finally {
      isExecuting.value = false
    }
  }

  const draftCount = () => changes.value.filter((c) => c.status === 'draft').length

  return {
    changes,
    isExecuting,
    addChange,
    removeChange,
    clearCompleted,
    executeAll,
    executeSingle,
    draftCount,
  }
})

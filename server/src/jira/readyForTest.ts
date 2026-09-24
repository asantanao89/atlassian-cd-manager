const REVIEW_TEXT = /pruebas cruzadas|code review/i

export interface ReadyForTestSubtask {
  summary: string
  statusName: string
}

function normalizeStatus(statusName: string): string {
  return statusName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

export type SprintActionRequired = 'Ready for test' | 'Prepare PO'

export function sprintActionRequired(
  storyStatus: string,
  subtasks: ReadyForTestSubtask[],
): SprintActionRequired | null {
  if (normalizeStatus(storyStatus) === 'finalizado desarrollo') return 'Prepare PO'
  if (isReadyForTest(storyStatus, subtasks)) return 'Ready for test'
  return null
}

export function isReadyForTest(storyStatus: string, subtasks: ReadyForTestSubtask[]): boolean {
  if (normalizeStatus(storyStatus) !== 'en desarrollo') return false

  let hasReviewToDo = false
  for (const subtask of subtasks) {
    const isReview = REVIEW_TEXT.test(subtask.summary)
    const status = normalizeStatus(subtask.statusName)
    if (isReview) {
      if (status === 'por hacer') hasReviewToDo = true
      continue
    }
    if (status !== 'hecho') return false
  }

  return hasReviewToDo
}

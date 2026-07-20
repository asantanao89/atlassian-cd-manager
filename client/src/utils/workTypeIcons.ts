/** Local work-type icons (Jira avatar URLs often require auth in the browser). */
export type WorkTypeIconKind = 'error' | 'historia' | 'tarea' | 'epica' | 'default'

export function workTypeIconKind(name: string): WorkTypeIconKind {
  const n = name.trim().toLowerCase()
  if (n === 'error' || n === 'bug') return 'error'
  if (n === 'historia' || n === 'story') return 'historia'
  if (n === 'tarea' || n === 'task') return 'tarea'
  if (n === 'epica' || n === 'épica' || n === 'epic') return 'epica'
  return 'default'
}

export function workTypeBadgeClass(name: string): string {
  switch (workTypeIconKind(name)) {
    case 'error':
      return 'bg-red-100 text-red-800'
    case 'historia':
      return 'bg-green-100 text-green-800'
    case 'tarea':
      return 'bg-blue-100 text-blue-800'
    case 'epica':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

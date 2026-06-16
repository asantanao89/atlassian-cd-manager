export function issueStatusBadgeClass(statusName: string): string {
  const value = statusName.trim().toLowerCase()
  if (!value) return 'bg-gray-100 text-gray-600'

  if (
    value.includes('hecho')
    || value.includes('listo')
    || value.includes('done')
    || value.includes('cerrad')
    || value.includes('resolved')
    || value.includes('complet')
  ) {
    return 'bg-green-100 text-green-700'
  }

  if (
    value.includes('producción')
    || value.includes('produccion')
    || value.includes('release')
    || value.includes('deploy')
  ) {
    return 'bg-green-100 text-green-700'
  }

  if (
    value.includes('en proceso')
    || value.includes('en progreso')
    || value.includes('progress')
    || value.includes('curso')
    || value.includes('doing')
    || value.includes('develop')
    || value.includes('implement')
  ) {
    return 'bg-blue-100 text-blue-700'
  }

  if (
    value.includes('por hacer')
    || value.includes('to do')
    || value.includes('todo')
    || value.includes('open')
    || value.includes('backlog')
    || value.includes('pend')
  ) {
    return 'bg-amber-100 text-amber-700'
  }

  if (
    value.includes('review')
    || value.includes('qa')
    || value.includes('test')
    || value.includes('valid')
  ) {
    return 'bg-purple-100 text-purple-700'
  }

  if (
    value.includes('block')
    || value.includes('imped')
    || value.includes('hold')
    || value.includes('stop')
  ) {
    return 'bg-red-100 text-red-700'
  }

  return 'bg-gray-100 text-gray-600'
}

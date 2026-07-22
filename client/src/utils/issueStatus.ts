function normalizeStatusName(statusName: string): string {
  return statusName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

export function issueStatusBadgeClass(statusName: string): string {
  const value = normalizeStatusName(statusName)
  if (!value) return 'bg-gray-100 text-gray-600'

  // Subtask in progress — keep blue (En Curso / En Proceso / En progreso)
  if (
    value === 'en curso'
    || value === 'en proceso'
    || value === 'en progreso'
    || value.includes('en curso')
    || value.includes('en proceso')
    || value.includes('en progreso')
    || value.includes('in progress')
    || value.includes('progress')
    || value.includes('doing')
  ) {
    return 'bg-blue-100 text-blue-700'
  }

  // CDPM parent/story workflow
  if (value === 'backlog' || value.includes('backlog')) {
    return 'bg-gray-100 text-gray-700'
  }

  if (
    value.includes('aceptacion po')
    || value.includes('aceptacion')
    || value.includes('en desarrollo')
    || value.includes('finalizado desarrollo')
    || value.includes('develop')
    || value.includes('implement')
  ) {
    return 'bg-blue-100 text-blue-700'
  }

  if (
    value.includes('descartado')
    || value.includes('produccion')
    || value.includes('release')
    || value.includes('deploy')
  ) {
    return 'bg-green-100 text-green-700'
  }

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

  // Generic "curso" after explicit phrases, so it does not steal other labels
  if (value.includes('curso')) {
    return 'bg-blue-100 text-blue-700'
  }

  if (
    value.includes('por hacer')
    || value.includes('to do')
    || value === 'todo'
    || value.includes('open')
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

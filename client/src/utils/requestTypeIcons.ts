export type RequestTypeIconKind = 'incidencia' | 'soporte' | 'default'

export function normalizeRequestTypeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function requestTypeIconKind(name: string): RequestTypeIconKind {
  const n = normalizeRequestTypeName(name)

  if (n.includes('incidencia') || n.includes('incident')) return 'incidencia'
  if (n.includes('soporte') || n.includes('support')) return 'soporte'
  return 'default'
}

function isRequestTypeCategoryQuery(query: string): boolean {
  const n = normalizeRequestTypeName(query)
  return n === 'incidencia' || n === 'incident' || n === 'soporte' || n === 'support'
}

export function matchesRequestType(value: string, query: string): boolean {
  if (!query.trim()) return true
  if (isRequestTypeCategoryQuery(query)) {
    return requestTypeIconKind(value) === requestTypeIconKind(query)
  }
  return normalizeRequestTypeName(value).includes(normalizeRequestTypeName(query))
}

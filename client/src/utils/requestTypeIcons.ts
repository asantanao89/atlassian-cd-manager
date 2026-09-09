export type RequestTypeIconKind = 'incidencia' | 'soporte' | 'default'

export function requestTypeIconKind(name: string): RequestTypeIconKind {
  const n = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

  if (n.includes('incidencia') || n.includes('incident')) return 'incidencia'
  if (n.includes('soporte') || n.includes('support')) return 'soporte'
  return 'default'
}

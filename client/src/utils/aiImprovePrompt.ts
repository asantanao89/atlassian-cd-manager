export type ImproveFieldId = 'summary' | 'description' | 'acceptanceCriteria'

export interface AiImprovePromptContext {
  summary: string
  description: string
  acceptanceCriteria: string
  componentName: string | null
  valor: string
  projectKey: string
  projectName: string
  issueTypeName: string
  unOptionValue: string
}

export const IMPROVE_FIELD_OPTIONS: Array<{ id: ImproveFieldId; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'description', label: 'Description' },
  { id: 'acceptanceCriteria', label: 'Criterios de Aceptación' },
]

export const DESCRIPTION_TEMPLATE_SECTIONS = [
  '1. Objetivo',
  '2. Descripción funcional',
  '3. Alcance',
  '4. Impacto / Dependencias',
  '5. Información adicional',
] as const

export const ACCEPTANCE_CRITERIA_TEMPLATE = [
  '| N | Contexto | Escenario | Comportamiento | Resultado |',
  '| --- | --- | --- | --- | --- |',
  '| 1 |  | DADO | CUANDO | ENTONCES |',
  '',
].join('\n')

export function fieldLabel(field: ImproveFieldId): string {
  return IMPROVE_FIELD_OPTIONS.find((f) => f.id === field)?.label ?? field
}

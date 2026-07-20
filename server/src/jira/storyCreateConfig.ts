/** Fixed CDPM issue create config (v1). */
export const STORY_CREATE_CONFIG = {
  projectKey: 'CDPM',
  projectName: 'CANAL DIGITAL - PROYECTOS & MANTENIMIENTO',
  /** Default work type when the form loads. */
  defaultIssueTypeId: '10009',
  /** Epica issue type used as Parent options. */
  epicIssueTypeId: '10000',
  epicIssueTypeName: 'Epica',
  /** Classic Epic Link field (kept in sync with parent when set). */
  epicLinkField: 'customfield_10014',
  /** Optional select: Pilares. */
  pilaresField: 'customfield_10067',
  pilaresOptions: [
    { id: '10354', value: '0 - Operativa' },
    { id: '10182', value: '1 - Mejora operativa' },
    { id: '10183', value: '2 - Gestión Conocimiento' },
    { id: '10184', value: '3 - Gestión equipo' },
    { id: '10185', value: '4 - Mejora tecnológica' },
    { id: '10186', value: '5 - Proyecto de negocio' },
  ] as const,
  /** Allowed CDPM work types (excludes Sub-tarea). */
  allowedIssueTypes: [
    { id: '10012', name: 'Error' },
    { id: '10009', name: 'Historia' },
    { id: '10010', name: 'Tarea' },
    { id: '10000', name: 'Epica' },
  ] as const,
  unField: 'customfield_10057',
  unOptionId: '10128',
  unOptionValue: 'Sin Asignación',
  valorField: 'customfield_10079',
  storyPointsField: 'customfield_10028',
  acceptanceCriteriaField: 'customfield_10161',
  /** Known CDPM components used in the create form. */
  allowedComponentIds: new Set(['10185', '10186', '10184', '10117', '10083', '10082']),
} as const

export const ALLOWED_ISSUE_TYPE_IDS: ReadonlySet<string> = new Set(
  STORY_CREATE_CONFIG.allowedIssueTypes.map((t) => t.id),
)

export const ALLOWED_PILARES_OPTION_IDS: ReadonlySet<string> = new Set(
  STORY_CREATE_CONFIG.pilaresOptions.map((o) => o.id),
)

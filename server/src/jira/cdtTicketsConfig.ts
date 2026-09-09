/** Fixed CDT (Jira Service Management) ticket list config. */
export const CDT_TICKETS_CONFIG = {
  projectKey: 'CDT',
  jql: 'project = CDT AND statusCategory != Done ORDER BY updated DESC',
  /** Customer Request Type on Jira Cloud JSM. */
  requestTypeField: 'customfield_10010',
  areaField: 'customfield_10064',
  departamentoField: 'customfield_10072',
  categoriaCanalDigitalField: 'customfield_10073',
  prioridadField: 'customfield_10058',
  unField: 'customfield_10057',
  blField: 'customfield_10081',
  /** Jira Cloud Sprint field (CDPM stories). */
  sprintField: 'customfield_10020',
  pageSize: 100,
  maxTickets: 300,
} as const

export const CDT_TICKET_DETAIL_FIELDS = [
  'summary',
  'description',
  'reporter',
  'assignee',
  'created',
  'labels',
  'priority',
  'issuelinks',
  'status',
  CDT_TICKETS_CONFIG.requestTypeField,
  CDT_TICKETS_CONFIG.areaField,
  CDT_TICKETS_CONFIG.departamentoField,
  CDT_TICKETS_CONFIG.categoriaCanalDigitalField,
  CDT_TICKETS_CONFIG.prioridadField,
  CDT_TICKETS_CONFIG.unField,
  CDT_TICKETS_CONFIG.blField,
] as const

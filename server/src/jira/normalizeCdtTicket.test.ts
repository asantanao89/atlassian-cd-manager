import { describe, expect, it } from 'vitest'
import {
  extractLinkedWorkItemKey,
  extractLinkedCdtKeys,
  extractOptionValue,
  extractRequestTypeName,
  extractSprintName,
  normalizeCdtTicket,
  normalizeCdtTicketDetails,
} from './normalizeCdtTicket'

describe('extractRequestTypeName', () => {
  it('returns empty string for missing values', () => {
    expect(extractRequestTypeName(null)).toBe('')
    expect(extractRequestTypeName(undefined)).toBe('')
  })

  it('reads requestType.name from the JSM cloud shape', () => {
    expect(
      extractRequestTypeName({
        requestType: { id: '42', name: 'Incidencia hardware' },
        currentStatus: { status: 'Waiting for support' },
      }),
    ).toBe('Incidencia hardware')
  })

  it('reads a top-level name', () => {
    expect(extractRequestTypeName({ name: 'Acceso a sistemas' })).toBe('Acceso a sistemas')
  })

  it('reads value and strips the project prefix', () => {
    expect(extractRequestTypeName({ value: 'CDT/Petición de software' })).toBe('Petición de software')
  })

  it('reads a plain string and strips the project prefix', () => {
    expect(extractRequestTypeName('CDT/Consulta')).toBe('Consulta')
  })
})

describe('normalizeCdtTicket', () => {
  it('maps key, summary, request type and reporter', () => {
    expect(
      normalizeCdtTicket({
        id: '10001',
        key: 'CDT-12',
        fields: {
          summary: 'No arranca el portátil',
          reporter: { displayName: 'Ana Pérez' },
          customfield_10010: {
            requestType: { name: 'Incidencia hardware' },
          },
        },
      }),
    ).toEqual({
      id: '10001',
      key: 'CDT-12',
      linkedKey: '',
      summary: 'No arranca el portátil',
      requestType: 'Incidencia hardware',
      reporterName: 'Ana Pérez',
      created: '',
      statusName: '',
      assigneeName: '',
      labels: [],
    })
  })

  it('uses empty strings when reporter and request type are missing', () => {
    expect(
      normalizeCdtTicket({
        id: '10002',
        key: 'CDT-13',
        fields: { summary: 'Sin tipo' },
      }),
    ).toEqual({
      id: '10002',
      key: 'CDT-13',
      linkedKey: '',
      summary: 'Sin tipo',
      requestType: '',
      reporterName: '',
      created: '',
      statusName: '',
      assigneeName: '',
      labels: [],
    })
  })

  it('maps the linked CDPM work item from issuelinks', () => {
    expect(
      normalizeCdtTicket({
        id: '241495',
        key: 'CDT-5803',
        fields: {
          summary: 'error precio',
          issuelinks: [
            {
              type: { name: 'Relacionada' },
              inwardIssue: { key: 'CDPM-23107', fields: { issuetype: { name: 'Error' } } },
            },
          ],
        },
      }),
    ).toMatchObject({ key: 'CDT-5803', linkedKey: 'CDPM-23107' })
  })

  it('maps created from Jira', () => {
    expect(
      normalizeCdtTicket({
        id: '10003',
        key: 'CDT-14',
        fields: {
          summary: 'Con fecha',
          created: '2026-09-09T10:32:00.000+0200',
        },
      }),
    ).toMatchObject({ created: '2026-09-09T10:32:00.000+0200' })
  })

  it('maps status from Jira', () => {
    expect(
      normalizeCdtTicket({
        id: '10004',
        key: 'CDT-15',
        fields: {
          summary: 'Con estado',
          status: { name: 'Waiting for support' },
        },
      }),
    ).toMatchObject({ statusName: 'Waiting for support' })
  })

  it('maps labels from Jira', () => {
    expect(
      normalizeCdtTicket({
        id: '10006',
        key: 'CDT-17',
        fields: {
          summary: 'Con labels',
          labels: ['proshop', 'pim'],
        },
      }),
    ).toMatchObject({ labels: ['proshop', 'pim'] })
  })

  it('maps assignee from Jira', () => {
    expect(
      normalizeCdtTicket({
        id: '10005',
        key: 'CDT-16',
        fields: {
          summary: 'Con asignado',
          assignee: { displayName: 'Alejandro Santana' },
        },
      }),
    ).toMatchObject({ assigneeName: 'Alejandro Santana' })
  })
})

describe('extractLinkedCdtKeys', () => {
  it('returns CDT keys from inward and outward links', () => {
    expect(
      extractLinkedCdtKeys([
        { inwardIssue: { key: 'CDT-5803' } },
        { outwardIssue: { key: 'CDPM-23107' } },
        { inwardIssue: { key: 'CDT-12' } },
      ]),
    ).toEqual(['CDT-5803', 'CDT-12'])
  })
})

describe('extractSprintName', () => {
  it('prefers the active sprint object', () => {
    expect(
      extractSprintName([
        { name: 'Sprint 1', state: 'closed' },
        { name: 'Sprint 2', state: 'active' },
      ]),
    ).toBe('Sprint 2')
  })

  it('parses the GreenHopper string form', () => {
    expect(
      extractSprintName(
        'com.atlassian.greenhopper.service.sprint.Sprint@abc[id=12,name=CD Sprint 9,state=ACTIVE,endDate=]',
      ),
    ).toBe('CD Sprint 9')
  })

  it('returns empty string when missing', () => {
    expect(extractSprintName(null)).toBe('')
    expect(extractSprintName([])).toBe('')
  })
})

describe('extractLinkedWorkItemKey', () => {
  it('returns empty string when there are no links', () => {
    expect(extractLinkedWorkItemKey(undefined)).toBe('')
    expect(extractLinkedWorkItemKey([])).toBe('')
  })

  it('prefers a CDPM key from an inward Relacionada link', () => {
    expect(
      extractLinkedWorkItemKey([
        {
          type: { name: 'Relacionada', inward: 'Relacionada con', outward: 'Relacionada con' },
          inwardIssue: { key: 'CDPM-23107' },
        },
      ]),
    ).toBe('CDPM-23107')
  })

  it('reads an outward CDPM link', () => {
    expect(
      extractLinkedWorkItemKey([{ outwardIssue: { key: 'CDPM-100' } }]),
    ).toBe('CDPM-100')
  })
})

describe('extractOptionValue', () => {
  it('reads select value and priority name', () => {
    expect(extractOptionValue({ value: 'Francia' })).toBe('Francia')
    expect(extractOptionValue({ name: 'Normal' })).toBe('Normal')
  })
})

describe('normalizeCdtTicketDetails', () => {
  it('maps CDT custom fields, labels and description', () => {
    expect(
      normalizeCdtTicketDetails({
        id: '241495',
        key: 'CDT-5803',
        fields: {
          summary: 'error precio',
          reporter: { displayName: 'Louna Lancel' },
          created: '2026-09-02T11:12:04.990+0200',
          labels: ['proshop'],
          priority: { name: 'Normal' },
          customfield_10064: { value: 'Dir. General Internacional' },
          customfield_10072: { value: 'Francia' },
          customfield_10073: { value: 'Dentalclick.fr' },
          customfield_10058: { value: 'Bloqueante (Me impide trabajar)' },
          customfield_10057: { value: 'Dentalclick' },
          customfield_10081: { value: '🛑' },
          description: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }],
          },
        },
      }),
    ).toMatchObject({
      key: 'CDT-5803',
      reporterName: 'Louna Lancel',
      area: 'Dir. General Internacional',
      departamento: 'Francia',
      categoriaCanalDigital: 'Dentalclick.fr',
      prioridad: 'Bloqueante (Me impide trabajar)',
      un: 'Dentalclick',
      labels: ['proshop'],
      priority: 'Normal',
      bl: '🛑',
      description: 'Hola',
    })
  })
})

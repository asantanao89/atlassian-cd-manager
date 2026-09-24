import { describe, expect, it } from 'vitest'
import { buildIssueAri, cursorFromLink, normalizeManualRules } from './manualRules'

describe('buildIssueAri', () => {
  it('builds the issue ARI Jira Automation expects', () => {
    expect(buildIssueAri('site-1', '10001')).toBe('ari:cloud:jira:site-1:issue/10001')
  })
})

describe('cursorFromLink', () => {
  it('reads the cursor query param from a relative link', () => {
    expect(cursorFromLink('?cursor=bbbbbb&limit=50')).toBe('bbbbbb')
  })

  it('returns null when the link has no cursor', () => {
    expect(cursorFromLink('?limit=50')).toBeNull()
    expect(cursorFromLink(null)).toBeNull()
  })
})

describe('normalizeManualRules', () => {
  it('keeps id, name and input prompts', () => {
    expect(
      normalizeManualRules({
        data: [
          {
            id: 1123,
            name: '(CD) ELFOS - Generar Backlog',
            userInputs: [
              {
                inputType: 'TEXT',
                displayName: 'Asunto',
                required: true,
                variableName: 'emailSubject',
                defaultValue: 'Hola',
              },
              {
                inputType: 'DROPDOWN',
                displayName: 'Equipo',
                required: false,
                variableName: 'team',
                defaultValue: ['ELFOS', 'ENANOS'],
              },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        id: '1123',
        name: '(CD) ELFOS - Generar Backlog',
        inputs: [
          {
            variableName: 'emailSubject',
            displayName: 'Asunto',
            inputType: 'TEXT',
            required: true,
            options: [],
            defaultValue: 'Hola',
          },
          {
            variableName: 'team',
            displayName: 'Equipo',
            inputType: 'DROPDOWN',
            required: false,
            options: ['ELFOS', 'ENANOS'],
            defaultValue: null,
          },
        ],
      },
    ])
  })

  it('prefers the rule uuid used to invoke the automation', () => {
    expect(
      normalizeManualRules({
        data: [{ id: 3022089, idUuid: '019c8004-0b57-7d3d-8aca-f1f7ac083892', name: 'Cambiar ticket a Incidencia' }],
      }),
    ).toEqual([
      {
        id: '019c8004-0b57-7d3d-8aca-f1f7ac083892',
        name: 'Cambiar ticket a Incidencia',
        inputs: [],
      },
    ])
  })

  it('drops rules without id or name', () => {
    expect(normalizeManualRules({ data: [{ id: '1' }, { name: 'Sin id' }, null] })).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { matchesRequestType, requestTypeIconKind } from '../utils/requestTypeIcons'

describe('requestTypeIconKind', () => {
  it('maps incidencia and incident variants', () => {
    expect(requestTypeIconKind('Incidencia')).toBe('incidencia')
    expect(requestTypeIconKind('Incident')).toBe('incidencia')
    expect(requestTypeIconKind('Incidencia hardware')).toBe('incidencia')
  })

  it('maps soporte variants', () => {
    expect(requestTypeIconKind('Soporte')).toBe('soporte')
    expect(requestTypeIconKind('Support')).toBe('soporte')
  })

  it('falls back to default for unknown or empty names', () => {
    expect(requestTypeIconKind('Consulta')).toBe('default')
    expect(requestTypeIconKind('')).toBe('default')
  })
})

describe('matchesRequestType', () => {
  it('treats summary category Soporte as Support', () => {
    expect(matchesRequestType('Support', 'Soporte')).toBe(true)
    expect(matchesRequestType('Soporte', 'Support')).toBe(true)
    expect(matchesRequestType('Soporte técnico', 'Soporte')).toBe(true)
  })

  it('treats summary category Incidencia as Incident', () => {
    expect(matchesRequestType('Incident', 'Incidencia')).toBe(true)
    expect(matchesRequestType('Incidencia hardware', 'Incidencia')).toBe(true)
  })

  it('keeps specific dropdown values exact enough not to mix categories', () => {
    expect(matchesRequestType('Incidencia', 'Incidencia hardware')).toBe(false)
    expect(matchesRequestType('Support', 'Incidencia')).toBe(false)
    expect(matchesRequestType('Consulta', 'Soporte')).toBe(false)
  })
})

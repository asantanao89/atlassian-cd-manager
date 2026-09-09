import { describe, expect, it } from 'vitest'
import { requestTypeIconKind } from '../utils/requestTypeIcons'

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

import { describe, expect, it } from 'vitest'
import { formatOpenDuration, openDurationTone } from '../utils/formatOpenDuration'

const at = (year: number, month: number, day: number, hour = 0): number =>
  new Date(year, month, day, hour).getTime()

describe('formatOpenDuration', () => {
  it('returns em dash for missing or invalid dates', () => {
    expect(formatOpenDuration('')).toBe('—')
    expect(formatOpenDuration('not-a-date')).toBe('—')
  })

  it('formats calendar months, days and hours', () => {
    expect(formatOpenDuration(new Date(2026, 0, 1).toISOString(), at(2026, 1, 3, 10))).toBe('1m 2d 10h')
  })

  it('omits zero units', () => {
    expect(formatOpenDuration(new Date(2026, 0, 1).toISOString(), at(2026, 0, 1, 10))).toBe('10h')
    expect(formatOpenDuration(new Date(2026, 0, 1).toISOString(), at(2026, 0, 3, 3))).toBe('2d 3h')
    expect(formatOpenDuration(new Date(2026, 0, 1).toISOString(), at(2026, 1, 1))).toBe('1m')
  })

  it('shows 0h when the story is less than an hour old', () => {
    expect(formatOpenDuration(new Date(2026, 0, 1, 0, 0).toISOString(), at(2026, 0, 1) + 30 * 60 * 1000)).toBe(
      '0h',
    )
  })
})

describe('openDurationTone', () => {
  it('returns null for missing or invalid dates', () => {
    expect(openDurationTone('')).toBeNull()
    expect(openDurationTone('not-a-date')).toBeNull()
  })

  it('is good for one week or less', () => {
    expect(openDurationTone(new Date(2026, 0, 1).toISOString(), at(2026, 0, 8))).toBe('good')
    expect(openDurationTone(new Date(2026, 0, 1).toISOString(), at(2026, 0, 3, 10))).toBe('good')
  })

  it('is warning after one week and until one month', () => {
    expect(openDurationTone(new Date(2026, 0, 1).toISOString(), at(2026, 0, 8, 1))).toBe('warning')
    expect(openDurationTone(new Date(2026, 0, 1).toISOString(), at(2026, 1, 1))).toBe('warning')
  })

  it('is attention after one month', () => {
    expect(openDurationTone(new Date(2026, 0, 1).toISOString(), at(2026, 1, 1, 1))).toBe('attention')
    expect(openDurationTone(new Date(2026, 0, 1).toISOString(), at(2026, 2, 1))).toBe('attention')
  })
})

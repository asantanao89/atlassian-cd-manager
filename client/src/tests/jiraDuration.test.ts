import { describe, it, expect } from 'vitest'
import {
  parseJiraDurationToSeconds,
  formatSecondsToJiraDuration,
  isValidJiraDuration,
} from '../utils/jiraDuration'

// Conversions: 1w=5d, 1d=8h, 1h=60m, 1m=60s
const M = 60
const H = M * 60
const D = H * 8
const W = D * 5

describe('parseJiraDurationToSeconds', () => {
  it('parses 30m', () => {
    expect(parseJiraDurationToSeconds('30m')).toBe(30 * M)
  })

  it('parses 1h', () => {
    expect(parseJiraDurationToSeconds('1h')).toBe(H)
  })

  it('parses 1h 30m', () => {
    expect(parseJiraDurationToSeconds('1h 30m')).toBe(H + 30 * M)
  })

  it('parses 1d', () => {
    expect(parseJiraDurationToSeconds('1d')).toBe(D)
  })

  it('parses 1w', () => {
    expect(parseJiraDurationToSeconds('1w')).toBe(W)
  })

  it('parses 1w 2d 3h 30m', () => {
    expect(parseJiraDurationToSeconds('1w 2d 3h 30m')).toBe(W + 2 * D + 3 * H + 30 * M)
  })

  it('parses 2d', () => {
    expect(parseJiraDurationToSeconds('2d')).toBe(2 * D)
  })

  it('throws on empty string', () => {
    expect(() => parseJiraDurationToSeconds('')).toThrow()
  })

  it('throws on whitespace only', () => {
    expect(() => parseJiraDurationToSeconds('   ')).toThrow()
  })

  it('throws on invalid string', () => {
    expect(() => parseJiraDurationToSeconds('abc')).toThrow()
  })

  it('throws on negative format', () => {
    expect(() => parseJiraDurationToSeconds('-1h')).toThrow()
  })
})

describe('formatSecondsToJiraDuration', () => {
  it('formats 0 as 0m', () => {
    expect(formatSecondsToJiraDuration(0)).toBe('0m')
  })

  it('formats 30 minutes', () => {
    expect(formatSecondsToJiraDuration(30 * M)).toBe('30m')
  })

  it('formats 1 hour', () => {
    expect(formatSecondsToJiraDuration(H)).toBe('1h')
  })

  it('formats 1h 30m', () => {
    expect(formatSecondsToJiraDuration(H + 30 * M)).toBe('1h 30m')
  })

  it('formats 1 day', () => {
    expect(formatSecondsToJiraDuration(D)).toBe('1d')
  })

  it('formats 1 week', () => {
    expect(formatSecondsToJiraDuration(W)).toBe('1w')
  })

  it('formats complex duration', () => {
    expect(formatSecondsToJiraDuration(W + 2 * D + 3 * H + 30 * M)).toBe('1w 2d 3h 30m')
  })

  it('throws on negative seconds', () => {
    expect(() => formatSecondsToJiraDuration(-1)).toThrow()
  })
})

describe('isValidJiraDuration', () => {
  it('returns true for valid durations', () => {
    expect(isValidJiraDuration('30m')).toBe(true)
    expect(isValidJiraDuration('1h')).toBe(true)
    expect(isValidJiraDuration('1d')).toBe(true)
    expect(isValidJiraDuration('1w')).toBe(true)
    expect(isValidJiraDuration('1w 2d 3h 30m')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(isValidJiraDuration('')).toBe(false)
  })

  it('returns false for invalid strings', () => {
    expect(isValidJiraDuration('abc')).toBe(false)
    expect(isValidJiraDuration('-1h')).toBe(false)
    expect(isValidJiraDuration('1x')).toBe(false)
  })
})

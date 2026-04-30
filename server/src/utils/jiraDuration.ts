/**
 * Jira duration parser and formatter.
 *
 * Conversion assumptions (must match Jira instance configuration):
 *   1 week  = 5 working days
 *   1 day   = 8 working hours
 *   1 hour  = 60 minutes
 *
 * These values may differ from your Jira instance settings.
 * Check "Jira settings > Time tracking" for the actual configuration.
 */

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * 60
const SECONDS_PER_DAY = SECONDS_PER_HOUR * 8
const SECONDS_PER_WEEK = SECONDS_PER_DAY * 5

const DURATION_PATTERN = /^(?:(\d+)w\s*)?(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?$/

export function parseJiraDurationToSeconds(input: string): number {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Duration cannot be empty')

  const match = trimmed.match(DURATION_PATTERN)
  if (!match || (!match[1] && !match[2] && !match[3] && !match[4])) {
    throw new Error(`Invalid Jira duration format: "${input}". Expected format: "1w 2d 3h 30m"`)
  }

  const weeks = parseInt(match[1] ?? '0', 10)
  const days = parseInt(match[2] ?? '0', 10)
  const hours = parseInt(match[3] ?? '0', 10)
  const minutes = parseInt(match[4] ?? '0', 10)

  return weeks * SECONDS_PER_WEEK + days * SECONDS_PER_DAY + hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE
}

export function formatSecondsToJiraDuration(seconds: number): string {
  if (seconds < 0) throw new Error('Seconds cannot be negative')
  if (seconds === 0) return '0m'

  let remaining = seconds
  const parts: string[] = []

  const weeks = Math.floor(remaining / SECONDS_PER_WEEK)
  remaining -= weeks * SECONDS_PER_WEEK
  if (weeks > 0) parts.push(`${weeks}w`)

  const days = Math.floor(remaining / SECONDS_PER_DAY)
  remaining -= days * SECONDS_PER_DAY
  if (days > 0) parts.push(`${days}d`)

  const hours = Math.floor(remaining / SECONDS_PER_HOUR)
  remaining -= hours * SECONDS_PER_HOUR
  if (hours > 0) parts.push(`${hours}h`)

  const minutes = Math.floor(remaining / SECONDS_PER_MINUTE)
  if (minutes > 0) parts.push(`${minutes}m`)

  return parts.join(' ')
}

export function isValidJiraDuration(input: string): boolean {
  try {
    const seconds = parseJiraDurationToSeconds(input)
    return seconds >= 0
  } catch {
    return false
  }
}

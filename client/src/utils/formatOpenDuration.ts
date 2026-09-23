const MS_PER_HOUR = 60 * 60 * 1000
const MS_PER_DAY = 24 * MS_PER_HOUR
const MS_PER_WEEK = 7 * MS_PER_DAY

export type OpenDurationTone = 'good' | 'warning' | 'attention'
export type OpenDurationRange = 'recent' | 'aging' | 'old'

export const OPEN_DURATION_RANGES: ReadonlyArray<{
  key: OpenDurationRange
  tone: OpenDurationTone
  label: string
}> = [
  { key: 'recent', tone: 'good', label: 'Reciente' },
  { key: 'aging', tone: 'warning', label: '1 semana – 1 mes' },
  { key: 'old', tone: 'attention', label: 'Más de 1 mes' },
]

const OPEN_DURATION_CHIP_CLASS: Record<OpenDurationTone, string> = {
  good: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-800',
  attention: 'bg-red-100 text-red-700',
}

const RANGE_BY_TONE: Record<OpenDurationTone, OpenDurationRange> = {
  good: 'recent',
  warning: 'aging',
  attention: 'old',
}

function addCalendarMonth(date: Date): Date {
  const next = new Date(date.getTime())
  const day = next.getDate()
  next.setMonth(next.getMonth() + 1)
  if (next.getDate() !== day) {
    next.setDate(0)
  }
  return next
}

export function formatOpenDuration(iso: string, now = Date.now()): string {
  const created = Date.parse(iso)
  if (Number.isNaN(created)) return '—'

  const start = new Date(created)
  const end = new Date(now)
  if (end.getTime() < start.getTime()) return '—'

  let months = 0
  const cursor = new Date(start.getTime())
  while (true) {
    const next = addCalendarMonth(cursor)
    if (next.getTime() > end.getTime()) break
    cursor.setTime(next.getTime())
    months += 1
  }

  const remainingMs = end.getTime() - cursor.getTime()
  const days = Math.floor(remainingMs / MS_PER_DAY)
  const hours = Math.floor((remainingMs % MS_PER_DAY) / MS_PER_HOUR)

  const parts: string[] = []
  if (months > 0) parts.push(`${months}m`)
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  return parts.length > 0 ? parts.join(' ') : '0h'
}

export function openDurationTone(iso: string, now = Date.now()): OpenDurationTone | null {
  const created = Date.parse(iso)
  if (Number.isNaN(created)) return null

  const start = new Date(created)
  if (now < start.getTime()) return null
  if (now - start.getTime() <= MS_PER_WEEK) return 'good'
  if (now <= addCalendarMonth(start).getTime()) return 'warning'
  return 'attention'
}

export function openDurationChipClass(iso: string, now = Date.now()): string | null {
  const tone = openDurationTone(iso, now)
  return tone ? OPEN_DURATION_CHIP_CLASS[tone] : null
}

export function openDurationRange(iso: string, now = Date.now()): OpenDurationRange | null {
  const tone = openDurationTone(iso, now)
  return tone ? RANGE_BY_TONE[tone] : null
}

export function isOpenDurationRange(value: string): value is OpenDurationRange {
  return OPEN_DURATION_RANGES.some((range) => range.key === value)
}

export function openDurationRangeChipClass(range: OpenDurationRange): string {
  const match = OPEN_DURATION_RANGES.find((item) => item.key === range)
  return match ? OPEN_DURATION_CHIP_CLASS[match.tone] : ''
}

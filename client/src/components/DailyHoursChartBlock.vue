<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMyMonthlyWorklogs } from '../composables/useMyMonthlyWorklogs'
import { usePendingChangesStore } from '../stores/pendingChanges.store'
import { useVacationDaysStore } from '../stores/vacationDays.store'
import { parseJiraDurationToSeconds } from '../utils/jiraDuration'
import type { PendingChange } from '../types/pendingChange'

interface TooltipState {
  visible: boolean
  x: number
  y: number
  lines: string[]
}

type RangeMode = 'week' | 'month'

interface DayBucket {
  date: Date
  seconds: number
  pendingSeconds: number
  isVacation: boolean
}

const emit = defineEmits<{
  requestLog: [startedAt: string]
  requestPendingReview: [dayIso: string]
  requestOverbookedReview: [dayIso: string]
}>()

const rangeMode = ref<RangeMode>('week')
const pendingChangesStore = usePendingChangesStore()
const { changes } = storeToRefs(pendingChangesStore)
const vacationStore = useVacationDaysStore()

const tooltip = ref<TooltipState>({ visible: false, x: 0, y: 0, lines: [] })

function showTooltip(event: MouseEvent, bucket: DayBucket): void {
  const lines: string[] = [
    bucket.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
  ]

  if (bucket.isVacation) {
    lines.push('🏖 Día de vacaciones')
  } else {
    lines.push(`Registrado: ${formatHours(bucket.seconds)}`)
    if (bucket.pendingSeconds !== 0) {
      lines.push(`Pendiente: ${formatSignedHours(bucket.pendingSeconds)}`)
    }
    const total = bucket.seconds + bucket.pendingSeconds
    if (total < 28800) {
      lines.push(`Faltan: ${formatHours(28800 - total)}`)
    } else if (total > 28800) {
      lines.push(`Extra: +${formatHours(total - 28800)}`)
    } else {
      lines.push('Objetivo cumplido ✓')
    }
  }

  tooltip.value = { visible: true, x: event.clientX, y: event.clientY, lines }
}

function hideTooltip(): void {
  tooltip.value.visible = false
}

function atStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfCurrentWeek(date: Date): Date {
  const day = date.getDay() === 0 ? 7 : date.getDay()
  const mondayOffset = day - 1
  const start = new Date(date)
  start.setDate(date.getDate() - mondayOffset)
  return atStartOfDay(start)
}

function startOfCurrentMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfCurrentMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function formatDurationParts(seconds: number): string {
  const roundedMinutes = Math.round(Math.abs(seconds) / 60)
  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60

  if (hours === 0 && minutes === 0) return '0m'
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function formatHours(seconds: number): string {
  return formatDurationParts(seconds)
}

function formatCompactHours(seconds: number): string {
  return formatDurationParts(seconds)
}

function formatSignedHours(seconds: number): string {
  const sign = seconds > 0 ? '+' : seconds < 0 ? '-' : ''
  return `${sign}${formatDurationParts(seconds)}`
}

function formatSignedCompactHours(seconds: number): string {
  if (seconds === 0) return '—'
  const sign = seconds > 0 ? '+' : '-'
  return `${sign}${formatDurationParts(seconds)}`
}

function shortWeekday(date: Date): string {
  return date.toLocaleDateString('es-ES', { weekday: 'short' })
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function readWorklogSeconds(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>

  if (typeof record.timeSpentSeconds === 'number') return record.timeSpentSeconds
  if (typeof record.timeSpent === 'string') {
    try {
      return parseJiraDurationToSeconds(record.timeSpent)
    } catch {
      return null
    }
  }
  return null
}

function readWorklogStarted(value: unknown): Date | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.started !== 'string') return null

  const date = atStartOfDay(new Date(record.started))
  if (Number.isNaN(date.getTime())) return null
  return date
}

function addPendingDelta(days: DayBucket[], date: Date | null, deltaSeconds: number): void {
  if (!date || isWeekend(date) || deltaSeconds === 0) return
  const bucket = days.find((item) => isSameDay(item.date, date))
  if (bucket) bucket.pendingSeconds += deltaSeconds
}

function applyPendingChanges(days: DayBucket[]): void {
  const activeChanges = changes.value.filter(
    (change: PendingChange) => change.status === 'draft' || change.status === 'running',
  )

  for (const change of activeChanges) {
    if (change.type === 'create-worklog') {
      const date = readWorklogStarted(change.after)
      const seconds = readWorklogSeconds(change.after)
      addPendingDelta(days, date, seconds ?? 0)
      continue
    }

    if (change.type === 'update-worklog') {
      const oldDate = readWorklogStarted(change.before)
      const oldSeconds = readWorklogSeconds(change.before) ?? 0
      addPendingDelta(days, oldDate, -oldSeconds)

      const newDate = readWorklogStarted(change.after)
      const newSeconds = readWorklogSeconds(change.after) ?? 0
      addPendingDelta(days, newDate, newSeconds)
      continue
    }

    if (change.type === 'delete-worklog') {
      const oldDate = readWorklogStarted(change.before)
      const oldSeconds = readWorklogSeconds(change.before) ?? 0
      addPendingDelta(days, oldDate, -oldSeconds)
    }
  }
}

const {
  data: worklogs,
  isLoading,
  error,
  refetch,
} = useMyMonthlyWorklogs()

const rangeDescription = computed(() => {
  if (rangeMode.value === 'week') return 'Referencia por día de la semana actual.'
  return 'Referencia por día del mes.'
})

const buckets = computed<DayBucket[]>(() => {
  const now = new Date()
  const rows = worklogs.value ?? []

  if (rangeMode.value === 'week') {
    const start = startOfCurrentWeek(now)
    const days: DayBucket[] = []

    for (let i = 0; i < 7; i += 1) {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      if (isWeekend(day)) continue
      days.push({ date: day, seconds: 0, pendingSeconds: 0, isVacation: vacationStore.isVacationDay(day) })
    }

    for (const row of rows) {
      const date = atStartOfDay(new Date(row.started))
      if (isWeekend(date)) continue
      const bucket = days.find((item) => isSameDay(item.date, date))
      if (bucket) bucket.seconds += row.timeSpentSeconds
    }

    applyPendingChanges(days)

    return days
  }

  const monthStart = startOfCurrentMonth(now)
  const monthEnd = endOfCurrentMonth(now)
  const daysInMonth = monthEnd.getDate()
  const days: DayBucket[] = []

  for (let i = 0; i < daysInMonth; i += 1) {
    const day = new Date(monthStart)
    day.setDate(monthStart.getDate() + i)
    if (isWeekend(day)) continue
    days.push({ date: day, seconds: 0, pendingSeconds: 0, isVacation: vacationStore.isVacationDay(day) })
  }

  for (const row of rows) {
    const date = atStartOfDay(new Date(row.started))
    if (isWeekend(date)) continue
    if (date.getMonth() !== monthStart.getMonth() || date.getFullYear() !== monthStart.getFullYear()) {
      continue
    }
    const bucket = days.find((item) => isSameDay(item.date, date))
    if (bucket) bucket.seconds += row.timeSpentSeconds
  }

  applyPendingChanges(days)

  return days
})

const maxSeconds = computed(() => {
  const values = buckets.value.flatMap((item) => [item.seconds, Math.abs(item.pendingSeconds)])
  return Math.max(...values, 1)
})

const totalSeconds = computed(() => buckets.value.reduce((acc, item) => acc + item.seconds, 0))
const pendingTotalSeconds = computed(() => buckets.value.reduce((acc, item) => acc + item.pendingSeconds, 0))
const hasPendingSeries = computed(() => buckets.value.some((item) => item.pendingSeconds !== 0))

const averageSeconds = computed(() => {
  if (buckets.value.length === 0) return 0
  return totalSeconds.value / buckets.value.length
})

function barHeight(seconds: number): number {
  if (seconds <= 0) return 8
  return Math.max(8, Math.round((seconds / maxSeconds.value) * 120))
}

function isBelowWorkingDayLimit(bucket: DayBucket): boolean {
  if (bucket.isVacation) return false
  return bucket.seconds + bucket.pendingSeconds < 8 * 60 * 60
}

function requestLogFromBucket(bucket: DayBucket): void {
  if (!isBelowWorkingDayLimit(bucket)) return

  const startedAt = new Date(bucket.date)
  startedAt.setHours(9, 0, 0, 0)
  emit('requestLog', startedAt.toISOString())
}

function handleBucketClick(bucket: DayBucket): void {
  if (bucket.isVacation) return

  if (bucket.seconds > 8 * 60 * 60) {
    emit('requestOverbookedReview', bucket.date.toISOString())
    return
  }

  if (bucket.pendingSeconds !== 0) {
    emit('requestPendingReview', bucket.date.toISOString())
    return
  }

  requestLogFromBucket(bucket)
}

const errorMessage = computed(() => {
  if (!error.value) return null
  return error.value instanceof Error
    ? error.value.message
    : 'Error al cargar horas por día'
})
</script>

<template>
  <section class="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
    <!-- Floating tooltip -->
    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        class="fixed z-50 pointer-events-none rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs text-gray-700 space-y-0.5 -translate-x-1/2 -translate-y-full"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y - 10}px` }"
      >
        <p v-for="(line, i) in tooltip.lines" :key="i" :class="i === 0 ? 'font-semibold text-gray-800' : ''">{{ line }}</p>
      </div>
    </Teleport>
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h2 class="text-sm font-semibold text-gray-700">Horas dedicadas por día</h2>
        <p class="text-xs text-gray-500">
          {{ rangeDescription }} Total periodo: <strong>{{ formatHours(totalSeconds) }}</strong>
          <template v-if="hasPendingSeries">
            <strong class="text-yellow-700">({{ formatSignedCompactHours(pendingTotalSeconds) }})</strong>
          </template>
          · Media diaria: <strong>{{ formatHours(averageSeconds) }}</strong>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <div class="inline-flex border border-gray-300 rounded overflow-hidden text-xs">
          <button
            class="px-2 py-1 transition-colors"
            :class="rangeMode === 'week' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
            @click="rangeMode = 'week'"
          >
            Semana
          </button>
          <button
            class="px-2 py-1 transition-colors"
            :class="rangeMode === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
            @click="rangeMode = 'month'"
          >
            Mes
          </button>
        </div>

        <button
          class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          @click="() => refetch()"
        >
          Actualizar
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="text-sm text-gray-500 py-8 text-center">Cargando gráfica...</div>

    <div v-else-if="errorMessage" class="text-sm text-red-600 bg-red-50 rounded p-3">
      {{ errorMessage }}
    </div>

    <div v-else class="overflow-x-auto">
      <div class="min-w-[640px]">
        <div class="flex items-start gap-2 h-40 border-b border-gray-200 pb-2">
          <div
            v-for="bucket in buckets"
            :key="bucket.date.toISOString()"
            class="flex-1 min-w-[16px] flex flex-col items-center"
            @mouseenter="(e) => showTooltip(e, bucket)"
            @mouseleave="hideTooltip"
            @mousemove="(e) => { tooltip.x = e.clientX; tooltip.y = e.clientY }"
          >
            <button
              type="button"
              class="w-full h-[120px] flex flex-col justify-end text-left"
              :class="bucket.isVacation ? 'cursor-default' : isBelowWorkingDayLimit(bucket) ? 'cursor-pointer' : 'cursor-default'"
              @click="handleBucketClick(bucket)"
            >
              <div
                v-if="hasPendingSeries && bucket.pendingSeconds !== 0"
                class="w-full rounded-t bg-yellow-400/90 hover:bg-yellow-500 transition-colors"
                :style="{ height: `${barHeight(Math.abs(bucket.pendingSeconds))}px` }"
              />
              <div
                class="w-full rounded-t transition-colors"
                :class="bucket.isVacation ? 'bg-violet-400/90' : bucket.seconds > 28800 ? 'bg-red-500/85 hover:bg-red-600' : bucket.seconds >= 28800 ? 'bg-green-500/85 hover:bg-green-600' : 'bg-blue-500/85 hover:bg-blue-600'"
                :style="{ height: `${bucket.isVacation ? barHeight(28800) : barHeight(bucket.seconds)}px` }"
              />
            </button>
          </div>
        </div>

        <div class="flex items-start gap-2 mt-2">
          <div
            v-for="bucket in buckets"
            :key="`label-${bucket.date.toISOString()}`"
            class="flex-1 min-w-[16px] text-center"
          >
            <p class="text-[10px] text-gray-500 uppercase">{{ shortWeekday(bucket.date) }}</p>
            <p class="text-[10px] text-gray-400">{{ bucket.date.getDate() }}</p>
            <p class="text-[10px] text-gray-600 font-medium" :title="formatHours(bucket.seconds)">
              {{ formatCompactHours(bucket.seconds) }}
              <span v-if="hasPendingSeries && bucket.pendingSeconds !== 0" class="text-yellow-700">
                {{ formatSignedCompactHours(bucket.pendingSeconds) }}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

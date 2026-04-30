<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useMonthlyWorklogs } from '../composables/useMonthlyWorklogs'

interface Props {
  year: number
  month: number // 0-based
}

const props = defineProps<Props>()

interface DayBucket {
  date: Date
  seconds: number
}

function isWeekend(date: Date): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function atStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
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

function shortWeekday(date: Date): string {
  return date.toLocaleDateString('es-ES', { weekday: 'short' })
}

const monthStart = computed(() => new Date(props.year, props.month, 1))
const monthEnd = computed(() => new Date(props.year, props.month + 1, 0))

const monthLabel = computed(() =>
  monthStart.value.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
)

const {
  data: worklogs,
  isLoading,
  error,
} = useMonthlyWorklogs(toRef(props, 'year'), toRef(props, 'month'))

const buckets = computed<DayBucket[]>(() => {
  const ms = monthStart.value
  const me = monthEnd.value
  const daysInMonth = me.getDate()
  const days: DayBucket[] = []

  for (let i = 0; i < daysInMonth; i++) {
    const day = new Date(ms)
    day.setDate(ms.getDate() + i)
    if (isWeekend(day)) continue
    days.push({ date: day, seconds: 0 })
  }

  const rows = worklogs.value ?? []
  for (const row of rows) {
    if (!row.started) continue
    const date = atStartOfDay(new Date(row.started))
    const bucket = days.find((item) => isSameDay(item.date, date))
    if (bucket) bucket.seconds += row.timeSpentSeconds ?? 0
  }

  return days
})

const maxSeconds = computed(() => {
  const values = buckets.value.map((item) => item.seconds)
  return Math.max(...values, 28800)
})

const totalSeconds = computed(() => buckets.value.reduce((acc, item) => acc + item.seconds, 0))

const averageSeconds = computed(() => {
  if (buckets.value.length === 0) return 0
  return totalSeconds.value / buckets.value.length
})

function barHeight(seconds: number): number {
  if (seconds <= 0) return 8
  return Math.max(8, Math.round((seconds / maxSeconds.value) * 120))
}
</script>

<template>
  <section class="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
    <div>
      <h2 class="text-sm font-semibold text-gray-700 capitalize">{{ monthLabel }}</h2>
      <p class="text-xs text-gray-500">
        Total: <strong>{{ formatHours(totalSeconds) }}</strong> · Media diaria: <strong>{{ formatHours(averageSeconds) }}</strong>
      </p>
    </div>

    <div v-if="isLoading" class="text-sm text-gray-500 py-8 text-center">Cargando histórico...</div>

    <div v-else-if="error" class="text-sm text-red-600 bg-red-50 rounded p-3">
      {{ error instanceof Error ? error.message : 'Error al cargar histórico' }}
    </div>

    <div v-else class="overflow-x-auto">
      <div class="min-w-[640px]">
        <div class="flex items-start gap-2 h-40 border-b border-gray-200 pb-2">
          <div
            v-for="bucket in buckets"
            :key="bucket.date.toISOString()"
            class="flex-1 min-w-[16px] flex flex-col items-center"
          >
            <div class="w-full h-[120px] flex flex-col justify-end text-left">
              <div
                class="w-full rounded-t transition-colors"
                :class="
                  bucket.seconds > 28800
                    ? 'bg-red-500/85'
                    : bucket.seconds >= 28800
                      ? 'bg-green-500/85'
                      : 'bg-blue-500/85'
                "
                :style="{ height: `${barHeight(bucket.seconds)}px` }"
              />
            </div>
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
            <p class="text-[10px] text-gray-600 font-medium">{{ formatCompactHours(bucket.seconds) }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

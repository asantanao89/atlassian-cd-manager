<script setup lang="ts">
import { computed } from 'vue'
import { useMyMonthlyWorklogs } from '../composables/useMyMonthlyWorklogs'
import { useVacationDaysStore } from '../stores/vacationDays.store'

const props = withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'Mi seguimiento de horas',
})

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function startOfWeek(): Date {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay()
  const mondayOffset = day - 1
  const d = new Date(now)
  d.setDate(now.getDate() - mondayOffset)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function endOfMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0)
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function countWorkingDaysInMonth(): number {
  const monthStart = startOfMonth()
  const monthEnd = endOfMonth()
  let workingDays = 0

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day)
    if (!isWeekend(date)) workingDays += 1
  }

  return workingDays
}

const vacationStore = useVacationDaysStore()

function countVacationDaysInRange(from: Date, to: Date): number {
  let count = 0
  const current = new Date(from)
  while (current <= to) {
    if (!isWeekend(current) && vacationStore.isVacationDay(current)) count += 1
    current.setDate(current.getDate() + 1)
  }
  return count
}

function formatHours(seconds: number): string {
  const hours = seconds / 3600
  return `${hours.toFixed(2)} h`
}

function formatTargetHours(hours: number): string {
  return `${hours} h`
}

const {
  data: worklogs,
  isLoading,
  error,
  refetch,
} = useMyMonthlyWorklogs()

const totals = computed(() => {
  const rows = worklogs.value ?? []
  const todayStart = startOfToday()
  const weekStart = startOfWeek()
  const monthStart = startOfMonth()

  let daySeconds = 0
  let weekSeconds = 0
  let monthSeconds = 0

  for (const row of rows) {
    const started = new Date(row.started)
    if (started >= todayStart) daySeconds += row.timeSpentSeconds
    if (started >= weekStart) weekSeconds += row.timeSpentSeconds
    if (started >= monthStart) monthSeconds += row.timeSpentSeconds
  }

  return {
    daySeconds,
    weekSeconds,
    monthSeconds,
  }
})

const targets = computed(() => {
  const today = startOfToday()
  const weekStart = startOfWeek()
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 4)
  const monthStart = startOfMonth()
  const monthEnd = endOfMonth()

  const dayVacation = vacationStore.isVacationDay(today) ? 1 : 0
  const weekVacation = countVacationDaysInRange(weekStart, weekEnd)
  const monthVacation = countVacationDaysInRange(monthStart, monthEnd)

  return {
    dayHours: Math.max(0, (1 - dayVacation) * 8),
    weekHours: Math.max(0, (5 - weekVacation) * 8),
    monthHours: Math.max(0, (countWorkingDaysInMonth() - monthVacation) * 8),
  }
})
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h2 class="text-sm font-semibold text-gray-700">{{ props.title }}</h2>
      <button
        class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors"
        @click="() => refetch()"
      >
        Actualizar
      </button>
    </div>

    <div v-if="isLoading" class="text-sm text-gray-500">Cargando resumen...</div>
    <div v-else-if="error" class="text-sm text-red-600">
      {{ error instanceof Error ? error.message : 'Error al cargar resumen de horas' }}
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <p class="text-xs text-gray-500">Hoy</p>
        <p class="flex items-end gap-2">
          <span class="text-2xl font-semibold text-gray-800">{{ formatHours(totals.daySeconds) }}</span>
          <span class="text-sm font-medium text-gray-400">/ {{ formatTargetHours(targets.dayHours) }}</span>
        </p>
      </div>
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <p class="text-xs text-gray-500">Semana</p>
        <p class="flex items-end gap-2">
          <span class="text-2xl font-semibold text-gray-800">{{ formatHours(totals.weekSeconds) }}</span>
          <span class="text-sm font-medium text-gray-400">/ {{ formatTargetHours(targets.weekHours) }}</span>
        </p>
      </div>
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <p class="text-xs text-gray-500">Mes</p>
        <p class="flex items-end gap-2">
          <span class="text-2xl font-semibold text-gray-800">{{ formatHours(totals.monthSeconds) }}</span>
          <span class="text-sm font-medium text-gray-400">/ {{ formatTargetHours(targets.monthHours) }}</span>
        </p>
      </div>
    </div>
  </section>
</template>

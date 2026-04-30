<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVacationDaysStore } from '../stores/vacationDays.store'

const isOpen = ref(false)
const vacationDaysStore = useVacationDaysStore()

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() // 0-based

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isWeekend(date: Date): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}

function startOfCurrentSprint(): Date {
  const weekStart = new Date(now)
  const day = weekStart.getDay() === 0 ? 7 : weekStart.getDay()
  weekStart.setDate(now.getDate() - (day - 1))
  weekStart.setHours(0, 0, 0, 0)

  const firstDayOfYear = new Date(weekStart.getFullYear(), 0, 1)
  const fdw = firstDayOfYear.getDay() === 0 ? 7 : firstDayOfYear.getDay()
  const firstMonday = new Date(firstDayOfYear)
  firstMonday.setDate(firstDayOfYear.getDate() - (fdw - 1))
  firstMonday.setHours(0, 0, 0, 0)

  const diffMs = weekStart.getTime() - firstMonday.getTime()
  const weekIndex = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  const sprintWeekIndex = weekIndex % 2 === 0 ? weekIndex : weekIndex - 1

  const sprintStart = new Date(firstMonday)
  sprintStart.setDate(firstMonday.getDate() + sprintWeekIndex * 7)
  return sprintStart
}

interface DayEntry { iso: string; label: string; isCurrentMonth: boolean }

/** Working days of the current month + sprint days outside the current month */
const allDays = computed<DayEntry[]>(() => {
  const seen = new Set<string>()
  const days: DayEntry[] = []

  // Current month working days
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear, currentMonth, d)
    if (isWeekend(date)) continue
    const iso = toIso(date)
    seen.add(iso)
    const label = date.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' })
    days.push({ iso, label, isCurrentMonth: true })
  }

  // Sprint days outside the current month
  const sprintStart = startOfCurrentSprint()
  for (let i = 0; i < 14; i++) {
    const date = new Date(sprintStart)
    date.setDate(sprintStart.getDate() + i)
    if (isWeekend(date)) continue
    const iso = toIso(date)
    if (seen.has(iso)) continue
    const label = date.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
    days.push({ iso, label, isCurrentMonth: false })
  }

  return days.sort((a, b) => a.iso.localeCompare(b.iso))
})

const monthLabel = computed(() =>
  new Date(currentYear, currentMonth, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  })
)

const vacationCount = computed(
  () => allDays.value.filter((d) => vacationDaysStore.isVacationDay(d.iso)).length
)
</script>

<template>
  <section class="space-y-2">
    <button
      class="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
      @click="isOpen = !isOpen"
    >
      <div>
        <p class="text-sm font-semibold text-gray-700">Vacaciones y ausencias</p>
        <p class="text-xs text-gray-500 capitalize">{{ monthLabel }} — pulsa un día para marcarlo</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
          {{ vacationCount }} días
        </span>
        <span class="text-xs text-gray-500">{{ isOpen ? '▼' : '▶' }}</span>
      </div>
    </button>

    <div v-if="isOpen" class="rounded-lg border border-gray-200 bg-white p-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="day in allDays"
          :key="day.iso"
          type="button"
          :title="day.iso"
          :class="[
            'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
            vacationDaysStore.isVacationDay(day.iso)
              ? 'border-violet-300 bg-violet-100 text-violet-800 hover:bg-violet-200'
              : day.isCurrentMonth
                ? 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100'
                : 'border-dashed border-gray-300 bg-white text-gray-400 hover:border-gray-400 hover:text-gray-600',
          ]"
          @click="vacationDaysStore.toggleVacationDay(day.iso)"
        >
          {{ day.label }}
        </button>
      </div>
    </div>
  </section>
</template>

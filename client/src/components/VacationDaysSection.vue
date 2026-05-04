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

function startOfWeek(date: Date): Date {
  const day = date.getDay() === 0 ? 7 : date.getDay()
  const start = new Date(date)
  start.setDate(date.getDate() - (day - 1))
  start.setHours(0, 0, 0, 0)
  return start
}

interface DayEntry { iso: string; label: string; isCurrentMonth: boolean }

/** Working days of the month plus out-of-month days from weeks that overlap this month. */
const allDays = computed<DayEntry[]>(() => {
  const days: DayEntry[] = []

  const monthStart = new Date(currentYear, currentMonth, 1)
  const monthEnd = new Date(currentYear, currentMonth + 1, 0)
  const firstWeekStart = startOfWeek(monthStart)
  const lastWeekStart = startOfWeek(monthEnd)
  const rangeEnd = new Date(lastWeekStart)
  rangeEnd.setDate(lastWeekStart.getDate() + 4)

  const cursor = new Date(firstWeekStart)
  while (cursor <= rangeEnd) {
    const date = new Date(cursor)
    cursor.setDate(cursor.getDate() + 1)
    if (isWeekend(date)) continue

    const iso = toIso(date)
    const isCurrentMonth = date.getFullYear() === currentYear && date.getMonth() === currentMonth
    const label = date.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      ...(isCurrentMonth ? {} : { month: 'short' }),
    })

    days.push({ iso, label, isCurrentMonth })
  }

  return days
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

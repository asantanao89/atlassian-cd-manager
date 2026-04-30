import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const VACATION_DAYS_STORAGE_KEY = 'jira-utilities:vacation-days'

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function normalizeDateKey(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null

  const normalized = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
  return normalized === value ? value : null
}

function loadVacationDays(): string[] {
  if (!canUseStorage()) return []

  try {
    const raw = window.localStorage.getItem(VACATION_DAYS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map(normalizeDateKey)
      .filter((item): item is string => item !== null)
      .sort()
  } catch {
    return []
  }
}

function saveVacationDays(days: string[]): void {
  if (!canUseStorage()) return

  try {
    window.localStorage.setItem(VACATION_DAYS_STORAGE_KEY, JSON.stringify(days))
  } catch {
    // Ignore storage write errors without breaking the app.
  }
}

export const useVacationDaysStore = defineStore('vacationDays', () => {
  const vacationDays = ref<string[]>(loadVacationDays())

  watch(
    vacationDays,
    (value) => {
      saveVacationDays(value)
    },
    { deep: true },
  )

  function addVacationDay(dateKey: string): void {
    const normalized = normalizeDateKey(dateKey)
    if (!normalized) return
    if (vacationDays.value.includes(normalized)) return
    vacationDays.value = [...vacationDays.value, normalized].sort()
  }

  function removeVacationDay(dateKey: string): void {
    vacationDays.value = vacationDays.value.filter((item) => item !== dateKey)
  }

  function toggleVacationDay(dateKey: string): void {
    if (vacationDays.value.includes(dateKey)) {
      removeVacationDay(dateKey)
      return
    }
    addVacationDay(dateKey)
  }

  function isVacationDay(date: Date | string): boolean {
    const dateKey = typeof date === 'string' ? date : `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
    return vacationDays.value.includes(dateKey)
  }

  const vacationDayCount = computed(() => vacationDays.value.length)

  return {
    vacationDays,
    vacationDayCount,
    addVacationDay,
    removeVacationDay,
    toggleVacationDay,
    isVacationDay,
  }
})

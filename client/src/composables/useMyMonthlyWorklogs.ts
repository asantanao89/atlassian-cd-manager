import { computed } from 'vue'
import { useMonthlyWorklogs, type WorklogPoint } from './useMonthlyWorklogs'

export type { WorklogPoint }

export function useMyMonthlyWorklogs() {
  const year = computed(() => new Date().getFullYear())
  const month = computed(() => new Date().getMonth())

  return useMonthlyWorklogs(year, month)
}

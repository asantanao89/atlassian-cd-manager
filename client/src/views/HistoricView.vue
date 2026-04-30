<script setup lang="ts">
import { ref, computed } from 'vue'
import HistoricChartBlock from '../components/HistoricChartBlock.vue'

const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth())
const showMonthPicker = ref(false)

const monthLabel = computed(() => {
  const date = new Date(selectedYear.value, selectedMonth.value, 1)
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
})

/** Last 6 months including current month */
const availableMonths = computed(() => {
  const months = []
  const currentDate = new Date(now.getFullYear(), now.getMonth(), 1)
  for (let i = 0; i < 6; i++) {
    const date = new Date(currentDate)
    date.setMonth(currentDate.getMonth() - i)
    months.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      label: date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
      isCurrent: date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(),
    })
  }
  return months
})

function selectMonth(year: number, month: number): void {
  selectedYear.value = year
  selectedMonth.value = month
  showMonthPicker.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-screen-xl mx-auto px-4 space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Histórico de horas</h1>
        <p class="text-sm text-gray-600">Visualización de horas trabajadas por mes sin edición</p>
      </div>

      <div class="relative bg-white rounded-lg border border-gray-200 p-4">
        <button
          class="w-full text-left flex items-center justify-between"
          @click="showMonthPicker = !showMonthPicker"
        >
          <div>
            <h2 class="text-lg font-semibold text-gray-900 capitalize">{{ monthLabel }}</h2>
            <p class="text-xs text-gray-500" v-if="selectedYear === now.getFullYear() && selectedMonth === now.getMonth()">Mes actual</p>
          </div>
          <span class="text-gray-500">{{ showMonthPicker ? '▼' : '▶' }}</span>
        </button>

        <div
          v-if="showMonthPicker"
          class="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 space-y-1"
        >
          <button
            v-for="m in availableMonths"
            :key="`${m.year}-${m.month}`"
            class="w-full text-left px-3 py-2 rounded text-sm transition-colors capitalize"
            :class="
              selectedYear === m.year && selectedMonth === m.month
                ? 'bg-blue-100 text-blue-700 font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            "
            @click="selectMonth(m.year, m.month)"
          >
            {{ m.label }}
            <span v-if="m.isCurrent" class="text-xs text-gray-500 ml-1">(actual)</span>
          </button>
        </div>
      </div>

      <HistoricChartBlock :year="selectedYear" :month="selectedMonth" />
    </div>
  </div>
</template>

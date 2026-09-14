<script setup lang="ts">
import { computed } from 'vue'

export interface TicketsSummaryBarItem {
  key: string
  label: string
  count: number
  to: { path: string; query: Record<string, string> }
  tagClass?: string
}

const props = defineProps<{
  title: string
  items: TicketsSummaryBarItem[]
}>()

const maxCount = computed(() => Math.max(1, ...props.items.map((item) => item.count)))

function barWidth(count: number): string {
  return `${Math.round((count / maxCount.value) * 100)}%`
}
</script>

<template>
  <section class="bg-white border border-gray-200 rounded-lg p-4 space-y-3 min-w-0">
    <h2 class="text-sm font-semibold text-gray-700">{{ props.title }}</h2>

    <p v-if="props.items.length === 0" class="text-xs text-gray-400 py-6 text-center">Sin datos</p>

    <div v-else class="space-y-2 max-h-72 overflow-y-auto pr-1">
      <RouterLink
        v-for="item in props.items"
        :key="item.key"
        :to="item.to"
        class="grid grid-cols-[9.5rem_1fr_2rem] items-center gap-2 rounded px-1 py-0.5 hover:bg-blue-50/60"
        :aria-label="`${item.label}: ${item.count}`"
      >
        <span class="min-w-0 truncate text-xs text-gray-600" :title="item.label">
          <span
            v-if="item.tagClass"
            class="inline-flex max-w-full truncate rounded px-1.5 py-0.5 font-medium"
            :class="item.tagClass"
          >
            {{ item.label }}
          </span>
          <span v-else>{{ item.label }}</span>
        </span>
        <div class="h-5 rounded bg-gray-100 overflow-hidden">
          <div
            class="h-full rounded-r bg-blue-500/85 transition-[width]"
            :style="{ width: barWidth(item.count) }"
          />
        </div>
        <span class="text-right text-xs font-medium text-gray-700 tabular-nums">{{ item.count }}</span>
      </RouterLink>
    </div>
  </section>
</template>

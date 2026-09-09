<script setup lang="ts">
import { computed } from 'vue'
import { requestTypeIconKind, type RequestTypeIconKind } from '../utils/requestTypeIcons'

const props = defineProps<{
  name: string
  size?: 'sm' | 'md'
}>()

const kind = computed<RequestTypeIconKind>(() => requestTypeIconKind(props.name))
const px = computed(() => (props.size === 'md' ? 18 : 16))
</script>

<template>
  <span class="inline-flex shrink-0" :style="{ width: `${px}px`, height: `${px}px` }" aria-hidden="true">
    <!-- Incidencia / Incident -->
    <svg v-if="kind === 'incidencia'" :width="px" :height="px" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.6 14.7 13.4c.3.5-.1 1.1-.7 1.1H2c-.6 0-1-.6-.7-1.1L8 1.6Z" fill="#E34935" />
      <path d="M8 6.2v3.4" stroke="#fff" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="8" cy="11.6" r=".8" fill="#fff" />
    </svg>

    <!-- Soporte -->
    <svg v-else-if="kind === 'soporte'" :width="px" :height="px" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#4BADE8" />
      <path d="M5 8.2V7a3 3 0 0 1 6 0v1.2" stroke="#fff" stroke-width="1.5" stroke-linecap="round" />
      <rect x="3.6" y="7.5" width="2.3" height="3.4" rx="0.9" fill="#fff" />
      <rect x="10.1" y="7.5" width="2.3" height="3.4" rx="0.9" fill="#fff" />
    </svg>

    <!-- Default -->
    <svg v-else :width="px" :height="px" viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="1.75" width="11" height="12.5" rx="1.5" fill="#6B778C" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="#fff" stroke-width="1.2" stroke-linecap="round" />
    </svg>
  </span>
</template>

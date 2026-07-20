<script setup lang="ts">
import { computed } from 'vue'
import { workTypeIconKind, type WorkTypeIconKind } from '../utils/workTypeIcons'

const props = defineProps<{
  name: string
  size?: 'sm' | 'md'
}>()

const kind = computed<WorkTypeIconKind>(() => workTypeIconKind(props.name))
const px = computed(() => (props.size === 'md' ? 18 : 16))
</script>

<template>
  <span class="inline-flex shrink-0" :style="{ width: `${px}px`, height: `${px}px` }" aria-hidden="true">
    <!-- Error / Bug -->
    <svg v-if="kind === 'error'" :width="px" :height="px" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.5a.75.75 0 0 1 .75.75v1.1a4.75 4.75 0 0 1 3.4 3.4h1.1a.75.75 0 0 1 0 1.5h-1.1a4.75 4.75 0 0 1-3.4 3.4v1.1a.75.75 0 0 1-1.5 0v-1.1a4.75 4.75 0 0 1-3.4-3.4H2.75a.75.75 0 0 1 0-1.5h1.1a4.75 4.75 0 0 1 3.4-3.4V2.25A.75.75 0 0 1 8 1.5Z"
        fill="#E34935"
      />
      <path d="M5.5 7.25h5M5.5 9.25h5" stroke="#fff" stroke-width="1.2" stroke-linecap="round" />
    </svg>

    <!-- Historia / Story -->
    <svg v-else-if="kind === 'historia'" :width="px" :height="px" viewBox="0 0 16 16" fill="none">
      <path
        d="M3.5 2.25c0-.414.336-.75.75-.75h5.086c.199 0 .39.079.53.22l2.664 2.664c.141.14.22.331.22.53V13c0 .966-.784 1.75-1.75 1.75h-6.75A.75.75 0 0 1 3.5 14V2.25Z"
        fill="#63BA3C"
      />
      <path d="M9.25 1.5v2.75c0 .414.336.75.75.75h2.75" fill="#4B9B2E" />
      <path d="M6 7.5h4M6 9.75h3" stroke="#fff" stroke-width="1.2" stroke-linecap="round" />
    </svg>

    <!-- Tarea / Task -->
    <svg v-else-if="kind === 'tarea'" :width="px" :height="px" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="2" fill="#4BADE8" />
      <path
        d="M5.2 8.1 7 9.9l3.8-3.8"
        stroke="#fff"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <!-- Epica / Epic -->
    <svg v-else-if="kind === 'epica'" :width="px" :height="px" viewBox="0 0 16 16" fill="none">
      <path
        d="M9.2 1.6 4.1 9.1c-.2.3 0 .7.4.7h3.1l-.9 4.4c-.1.4.4.7.7.4l5.1-7.5c.2-.3 0-.7-.4-.7H8.9l1-.4.7-4c.1-.4-.4-.7-.7-.4Z"
        fill="#904EE2"
      />
    </svg>

    <!-- Default -->
    <svg v-else :width="px" :height="px" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" fill="#6B778C" />
    </svg>
  </span>
</template>

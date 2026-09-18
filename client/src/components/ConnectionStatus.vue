<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { jiraApi } from '../api/jiraApi'
import { useEscapeToClose } from '../composables/useEscapeToClose'

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const {
  data: me,
  isLoading,
  isFetching,
  isError,
  refetch,
} = useQuery({
  queryKey: ['jira-me'],
  queryFn: () => jiraApi.getMe(),
  retry: false,
})

const { data: connectionInfo } = useQuery({
  queryKey: ['jira-connection-info'],
  queryFn: () => jiraApi.getConnectionInfo(),
  retry: false,
})

const statusDotClass = computed(() => {
  if (isLoading.value) return 'bg-yellow-400 animate-pulse'
  if (isError.value) return 'bg-red-500'
  if (me.value) return 'bg-green-500'
  return 'bg-gray-300'
})

const initials = computed(() => {
  const parts = (me.value?.displayName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('es-ES')
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toLocaleUpperCase('es-ES')
})

function toggle(): void {
  open.value = !open.value
}

function close(): void {
  open.value = false
}

function handleRetry(): void {
  void refetch()
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!open.value) return
  const el = rootEl.value
  if (el && !el.contains(event.target as Node)) close()
}

useEscapeToClose(close, open)

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})
</script>

<template>
  <div ref="rootEl" class="relative shrink-0">
    <button
      type="button"
      class="relative flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold tracking-wide transition-colors"
      :class="
        me
          ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
          : 'border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200'
      "
      :aria-expanded="open"
      aria-haspopup="menu"
      aria-label="Cuenta y conexión Jira"
      @click="toggle"
    >
      <span v-if="initials">{{ initials }}</span>
      <svg
        v-else
        viewBox="0 0 20 20"
        fill="currentColor"
        class="h-4 w-4"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z"
          clip-rule="evenodd"
        />
      </svg>
      <span
        class="absolute bottom-0 right-0 h-2 w-2 rounded-full ring-2 ring-white"
        :class="statusDotClass"
      />
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
      role="menu"
    >
      <div v-if="isLoading" class="flex items-center gap-2 text-sm text-gray-500">
        <span class="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
        Conectando con Jira...
      </div>

      <div v-else-if="isError" class="flex items-center gap-2 text-sm text-red-600">
        <span class="h-2 w-2 rounded-full bg-red-500" />
        Sin conexión con Jira
      </div>

      <div v-else-if="me" class="space-y-1">
        <div class="flex items-center gap-2 text-sm text-gray-800">
          <span class="h-2 w-2 rounded-full bg-green-500" />
          <span class="font-medium">{{ me.displayName }}</span>
        </div>
        <p v-if="me.emailAddress" class="pl-4 text-xs text-gray-500">{{ me.emailAddress }}</p>
        <a
          v-if="connectionInfo?.jiraBaseUrl"
          class="block pl-4 text-xs text-blue-600 hover:text-blue-800 break-all"
          :href="connectionInfo.jiraBaseUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ connectionInfo.jiraBaseUrl }}
        </a>
      </div>

      <button
        type="button"
        class="mt-3 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        :disabled="isFetching"
        @click="handleRetry"
      >
        {{ isFetching ? 'Probando...' : 'Probar conexión' }}
      </button>
    </div>
  </div>
</template>

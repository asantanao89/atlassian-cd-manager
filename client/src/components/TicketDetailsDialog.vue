<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { marked } from 'marked'
import { useEscapeToClose } from '../composables/useEscapeToClose'
import { formatCreatedAt } from '../composables/useTicketsTableFilters'
import { jiraApi } from '../api/jiraApi'
import type { CdtTicket } from '../types/jira'

marked.setOptions({ breaks: true, gfm: true })

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

const props = defineProps<{
  ticket: CdtTicket
  jiraBaseUrl: string
}>()

const emit = defineEmits<{
  close: []
}>()

useEscapeToClose(() => emit('close'))

const {
  data: details,
  isLoading,
  error,
} = useQuery({
  queryKey: ['cdt-ticket-details', props.ticket.key],
  queryFn: () => jiraApi.getCdtTicket(props.ticket.key),
  retry: 1,
})

const errorMessage = computed(() => {
  if (!error.value) return null
  return error.value instanceof Error ? error.value.message : 'Error al cargar el detalle'
})

const descriptionHtml = computed(() => {
  const markdown = details.value?.description?.trim()
  if (!markdown) return ''
  const html = marked.parse(markdown, { async: false }) as string
  return html.replace(/(<img\b[^>]*\bsrc=["'])(\/api\/)/gi, `$1${API_BASE_URL}$2`)
})

function issueBrowseUrl(issueKey: string): string {
  if (!props.jiraBaseUrl) return '#'
  return `${props.jiraBaseUrl}/browse/${encodeURIComponent(issueKey)}`
}

function display(value: string | undefined): string {
  return value?.trim() ? value : '—'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="emit('close')"
    >
      <div
        class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-details-title"
      >
        <div class="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-3 shrink-0">
          <h2 id="ticket-details-title" class="text-base font-semibold text-gray-900">
            Details
          </h2>
          <button
            type="button"
            class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
            @click="emit('close')"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div class="px-6 py-4 overflow-y-auto min-h-0">
          <div v-if="isLoading" class="flex items-center justify-center py-10 text-sm text-gray-500">
            Cargando detalle...
          </div>
          <div v-else-if="errorMessage" class="text-sm text-red-600">
            {{ errorMessage }}
          </div>
          <div v-else-if="details" class="space-y-4 text-sm">
            <dl class="grid grid-cols-3 gap-x-4 gap-y-3">
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Request type</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.requestType) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Key</dt>
                <dd class="mt-0.5 font-mono font-medium">
                  <a
                    v-if="jiraBaseUrl"
                    class="text-blue-600 hover:text-blue-800 underline"
                    :href="issueBrowseUrl(details.key)"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ details.key }}
                  </a>
                  <span v-else>{{ details.key }}</span>
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Created at</dt>
                <dd class="mt-0.5 text-gray-800">{{ formatCreatedAt(details.created) || '—' }}</dd>
              </div>

              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Reporter</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.reporterName) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Area</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.area) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Departamento</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.departamento) }}</dd>
              </div>

              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Categoría Canal Digital</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.categoriaCanalDigital) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Prioridad</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.prioridad) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">UN</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.un) }}</dd>
              </div>

              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Labels</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.labels) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Priority</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.priority) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">BL</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.bl) }}</dd>
              </div>
            </dl>

            <dl class="grid grid-cols-3 gap-x-4 gap-y-3">
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Story</dt>
                <dd class="mt-0.5 font-mono font-medium">
                  <a
                    v-if="details.linkedKey && jiraBaseUrl"
                    class="text-blue-600 hover:text-blue-800 underline"
                    :href="issueBrowseUrl(details.linkedKey)"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ details.linkedKey }}
                  </a>
                  <span v-else-if="details.linkedKey">{{ details.linkedKey }}</span>
                  <span v-else class="font-sans font-normal text-gray-400">—</span>
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-gray-500">Status</dt>
                <dd class="mt-0.5 text-gray-800">{{ display(details.linkedStatus) }}</dd>
              </div>
              <div />
            </dl>

            <div>
              <div class="text-xs font-medium uppercase tracking-wide text-gray-500">Summary</div>
              <p class="mt-0.5 text-gray-800 whitespace-pre-wrap">{{ display(details.summary) }}</p>
            </div>

            <div>
              <div class="text-xs font-medium uppercase tracking-wide text-gray-500">Description</div>
              <div
                v-if="descriptionHtml"
                class="markdown-preview mt-1 text-gray-800 break-words min-w-0"
                v-html="descriptionHtml"
              />
              <p v-else class="mt-0.5 text-gray-400">—</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4) {
  font-weight: 600;
  color: #1f2937;
  margin-top: 0.75rem;
  margin-bottom: 0.35rem;
  line-height: 1.3;
}

.markdown-preview :deep(p) {
  margin: 0.35rem 0;
  line-height: 1.5;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin: 0.35rem 0;
  padding-left: 1.25rem;
}

.markdown-preview :deep(ul) {
  list-style-type: disc;
}

.markdown-preview :deep(ol) {
  list-style-type: decimal;
}

.markdown-preview :deep(li) {
  margin: 0.15rem 0;
  line-height: 1.45;
}

.markdown-preview :deep(strong) {
  font-weight: 600;
}

.markdown-preview :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  background: #f3f4f6;
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
}

.markdown-preview :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0.5rem 0;
  border-radius: 0.25rem;
  border: 1px solid #e5e7eb;
}

.markdown-preview :deep(> :first-child) {
  margin-top: 0;
}
</style>

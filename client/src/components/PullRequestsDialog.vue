<script setup lang="ts">
import { computed } from 'vue'
import { useEscapeToClose } from '../composables/useEscapeToClose'
import type { JiraOpenPullRequest } from '../types/jira'
import {
  developmentStateBadgeClass,
  groupPullRequestsByRepository,
} from '../utils/developmentStatus'

const props = defineProps<{
  issueKey: string
  pullRequests: JiraOpenPullRequest[]
  branchCount: number
  commitCount: number
  isLoading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

useEscapeToClose(() => emit('close'))

const groups = computed(() => groupPullRequestsByRepository(props.pullRequests))

function displayPrId(pr: JiraOpenPullRequest): string {
  const raw = pr.id.trim()
  const fromUrl = raw.match(/\/(?:pull-requests?|pull)\/(\d+)/i)
  if (fromUrl) return `#${fromUrl[1]}`
  const digits = raw.replace(/^#/, '')
  if (/^\d+$/.test(digits)) return `#${digits}`
  return raw.startsWith('#') ? raw : `#${raw}`
}

function displayPrState(state: string | null): string {
  const value = (state ?? '').trim()
  return value ? value.toUpperCase() : 'UNKNOWN'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="emit('close')"
    >
      <div
        class="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pull-requests-title"
      >
        <div class="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <div>
            <h2 id="pull-requests-title" class="text-base font-semibold text-gray-900">
              Pull requests
            </h2>
            <p class="mt-0.5 text-xs text-gray-500">{{ props.issueKey }}</p>
          </div>
          <button
            type="button"
            class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
            @click="emit('close')"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
              <path
                d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
              />
            </svg>
          </button>
        </div>

        <div class="overflow-y-auto px-5 py-4">
          <p v-if="props.isLoading" class="py-6 text-center text-sm text-gray-500">
            Cargando desarrollo...
          </p>
          <p v-else-if="props.error" class="py-6 text-center text-sm text-red-600">
            {{ props.error }}
          </p>
          <template v-else>
          <p
            v-if="props.branchCount > 0 || props.commitCount > 0"
            class="mb-4 text-xs text-gray-500"
          >
            <span v-if="props.branchCount > 0">
              {{ props.branchCount }} {{ props.branchCount === 1 ? 'branch' : 'branches' }}
            </span>
            <span v-if="props.branchCount > 0 && props.commitCount > 0"> · </span>
            <span v-if="props.commitCount > 0">
              {{ props.commitCount }} {{ props.commitCount === 1 ? 'commit' : 'commits' }}
            </span>
          </p>
          <p v-if="props.pullRequests.length === 0" class="py-6 text-center text-sm text-gray-400">
            No hay pull requests.
          </p>

          <div v-else class="space-y-6">
            <section v-for="group in groups" :key="`${group.name}::${group.provider ?? ''}`">
              <h3 class="mb-3 text-sm">
                <a
                  v-if="group.url"
                  class="font-medium text-blue-700 hover:underline"
                  :href="group.url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ group.name }}
                </a>
                <span v-else class="font-medium text-blue-700">{{ group.name }}</span>
                <span v-if="group.provider" class="text-gray-500"> ({{ group.provider }})</span>
              </h3>
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th class="pb-2 pr-4">ID</th>
                    <th class="pb-2 pr-4">Summary</th>
                    <th class="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="pr in group.pullRequests" :key="`${pr.id}::${pr.url ?? ''}`">
                    <td class="whitespace-nowrap py-3 pr-4 align-top text-gray-500">
                      {{ displayPrId(pr) }}
                    </td>
                    <td class="py-3 pr-4 align-top">
                      <a
                        v-if="pr.url"
                        class="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        :href="pr.url"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {{ pr.title || displayPrId(pr) }}
                      </a>
                      <span v-else class="font-medium text-gray-800">{{ pr.title || displayPrId(pr) }}</span>
                      <div
                        v-if="pr.sourceBranch || pr.targetBranch"
                        class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-600"
                      >
                        <span
                          v-if="pr.sourceBranch"
                          class="inline-flex max-w-[18rem] truncate rounded bg-gray-100 px-1.5 py-0.5"
                          :title="pr.sourceBranch"
                        >
                          {{ pr.sourceBranch }}
                        </span>
                        <span v-if="pr.sourceBranch && pr.targetBranch" class="text-gray-400">→</span>
                        <span
                          v-if="pr.targetBranch"
                          class="inline-flex max-w-[12rem] truncate rounded bg-gray-100 px-1.5 py-0.5"
                          :title="pr.targetBranch"
                        >
                          {{ pr.targetBranch }}
                        </span>
                      </div>
                    </td>
                    <td class="whitespace-nowrap py-3 align-top text-right">
                      <span
                        class="inline-flex rounded px-1.5 py-0.5 text-xs font-medium"
                        :class="developmentStateBadgeClass(displayPrState(pr.state))"
                      >
                        {{ displayPrState(pr.state) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

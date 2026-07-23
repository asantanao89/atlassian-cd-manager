<script setup lang="ts">
import { computed, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { bitbucketApi } from '../api/bitbucketApi'
import { useWorktreeSettings } from '../composables/useWorktreeSettings'
import { openWorktreeInIde } from '../utils/openWorktree'
import {
  buildWorktreeFolderPath,
  isWorktreeSettingsReady,
  type WorktreeIde,
} from '../utils/worktreeSettings'

const props = defineProps<{
  issueKey: string
}>()

const { settings, repoSlug, ide } = useWorktreeSettings()

const { data: reposData } = useQuery({
  queryKey: ['bitbucket-repos'],
  queryFn: () => bitbucketApi.getRepos(),
  retry: 1,
})

watch(
  () => reposData.value?.repos,
  (repos) => {
    if (!repos || repos.length === 0) return
    if (!repoSlug.value || !repos.includes(repoSlug.value)) {
      repoSlug.value = repos[0]
    }
  },
  { immediate: true },
)

const canOpen = computed(() => isWorktreeSettingsReady(settings.value))

const targetPath = computed(() => buildWorktreeFolderPath(settings.value.repoSlug, props.issueKey))

const disabledTitle = computed(() => {
  if (canOpen.value) return targetPath.value ?? ''
  return 'Selecciona un repositorio'
})

function onIdeChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'cursor' || value === 'vscode') {
    ide.value = value as WorktreeIde
  }
}

function onRepoChange(event: Event): void {
  repoSlug.value = (event.target as HTMLSelectElement).value
}

function openWorktree(): void {
  if (!targetPath.value || !canOpen.value) return
  openWorktreeInIde(targetPath.value, ide.value)
}
</script>

<template>
  <div class="flex flex-col items-stretch gap-1 min-w-[7.5rem]">
    <select
      class="rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      :value="repoSlug"
      aria-label="Repositorio del worktree"
      @change="onRepoChange"
    >
      <option value="" disabled>Repo</option>
      <option v-for="repo in reposData?.repos ?? []" :key="repo" :value="repo">
        {{ repo }}
      </option>
    </select>
    <div class="flex items-center gap-1">
      <select
        class="min-w-0 flex-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        :value="ide"
        :title="disabledTitle"
        aria-label="IDE para abrir worktree"
        @change="onIdeChange"
      >
        <option value="vscode">VS Code</option>
        <option value="cursor">Cursor</option>
      </select>
      <button
        type="button"
        class="rounded border border-sky-300 px-1.5 py-1 text-[11px] text-sky-700 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canOpen"
        :title="disabledTitle"
        @click="openWorktree"
      >
        Abrir
      </button>
    </div>
  </div>
</template>

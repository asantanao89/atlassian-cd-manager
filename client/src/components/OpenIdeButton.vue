<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { bitbucketApi } from '../api/bitbucketApi'
import { useEscapeToClose } from '../composables/useEscapeToClose'
import { useWorktreeSettings } from '../composables/useWorktreeSettings'
import { openWorktreeInIde } from '../utils/openWorktree'
import {
  buildOpenFolderPath,
  isWorktreeSettingsReady,
  type WorktreeIde,
  type WorktreeOpenTarget,
} from '../utils/worktreeSettings'

const props = defineProps<{
  issueKey: string
}>()

const isOpen = ref(false)
const { settings, repoSlug, ide, openTarget } = useWorktreeSettings()

const { data: reposData } = useQuery({
  queryKey: ['bitbucket-repos'],
  queryFn: () => bitbucketApi.getRepos(),
  retry: 1,
  enabled: isOpen,
})

watch(
  [isOpen, () => reposData.value?.repos],
  ([visible, repos]) => {
    if (!visible || !repos || repos.length === 0) return
    if (!repoSlug.value || !repos.includes(repoSlug.value)) {
      repoSlug.value = repos[0]
    }
  },
)

const canOpen = computed(() => isWorktreeSettingsReady(settings.value))

const targetPath = computed(() =>
  buildOpenFolderPath(settings.value.openTarget, settings.value.repoSlug, props.issueKey),
)

function openDialog(): void {
  isOpen.value = true
}

function closeDialog(): void {
  isOpen.value = false
}

useEscapeToClose(closeDialog, isOpen)

function onIdeChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'cursor' || value === 'vscode') {
    ide.value = value as WorktreeIde
  }
}

function onTargetChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'worktree' || value === 'project') {
    openTarget.value = value as WorktreeOpenTarget
  }
}

function onRepoChange(event: Event): void {
  repoSlug.value = (event.target as HTMLSelectElement).value
}

function confirmOpen(): void {
  if (!targetPath.value || !canOpen.value) return
  openWorktreeInIde(targetPath.value, ide.value)
  closeDialog()
}
</script>

<template>
  <button
    type="button"
    class="w-full text-xs px-2 py-1 rounded border border-sky-300 hover:bg-sky-50 text-sky-700 transition-colors"
    title="Abrir worktree o proyecto en el IDE"
    @click="openDialog"
  >
    Abrir en IDE
  </button>

  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="closeDialog"
    >
      <div class="bg-white rounded-lg shadow-xl p-5 max-w-sm w-full mx-4 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Abrir en IDE</h2>
            <p class="mt-0.5 font-mono text-xs text-gray-500">{{ issueKey }}</p>
          </div>
          <button
            type="button"
            class="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Cerrar"
            @click="closeDialog"
          >
            ×
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">Repositorio</label>
            <select
              class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              :value="repoSlug"
              @change="onRepoChange"
            >
              <option value="" disabled>Selecciona un repositorio</option>
              <option v-for="repo in reposData?.repos ?? []" :key="repo" :value="repo">
                {{ repo }}
              </option>
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">Carpeta</label>
            <select
              class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              :value="openTarget"
              @change="onTargetChange"
            >
              <option value="worktree">Worktree</option>
              <option value="project">Proyecto</option>
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">IDE</label>
            <select
              class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              :value="ide"
              @change="onIdeChange"
            >
              <option value="vscode">VS Code</option>
              <option value="cursor">Cursor</option>
            </select>
          </div>

          <p v-if="targetPath" class="rounded bg-gray-50 px-2 py-1.5 font-mono text-[11px] text-gray-500 break-all">
            {{ targetPath }}
          </p>
        </div>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors"
            @click="closeDialog"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded bg-sky-600 text-white hover:bg-sky-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canOpen"
            @click="confirmOpen"
          >
            Abrir
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

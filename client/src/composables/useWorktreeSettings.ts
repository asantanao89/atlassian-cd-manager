import { computed, ref, watch } from 'vue'
import {
  loadWorktreeSettings,
  saveWorktreeSettings,
  type WorktreeIde,
  type WorktreeOpenTarget,
  type WorktreeSettings,
} from '../utils/worktreeSettings'

const settings = ref<WorktreeSettings>(loadWorktreeSettings())

watch(
  settings,
  (next) => {
    saveWorktreeSettings(next)
  },
  { deep: true },
)

export function useWorktreeSettings() {
  const repoSlug = computed({
    get: () => settings.value.repoSlug,
    set: (value: string) => {
      settings.value = { ...settings.value, repoSlug: value }
    },
  })

  const ide = computed({
    get: () => settings.value.ide,
    set: (value: WorktreeIde) => {
      settings.value = { ...settings.value, ide: value }
    },
  })

  const openTarget = computed({
    get: () => settings.value.openTarget,
    set: (value: WorktreeOpenTarget) => {
      settings.value = { ...settings.value, openTarget: value }
    },
  })

  return {
    settings,
    repoSlug,
    ide,
    openTarget,
  }
}

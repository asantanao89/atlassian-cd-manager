import { computed, ref, watch } from 'vue'
import {
  loadWorktreeSettings,
  saveWorktreeSettings,
  type WorktreeIde,
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

  return {
    settings,
    repoSlug,
    ide,
  }
}

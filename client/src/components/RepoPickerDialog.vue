<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { bitbucketApi } from '../api/bitbucketApi'

const props = defineProps<{
  show: boolean
  sourceKey: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()

const repos = ref<string[]>([])
const selectedRepo = ref('')
const isLoading = ref(false)

watch(
  () => props.show,
  async (visible) => {
    if (!visible) return
    selectedRepo.value = ''
    isLoading.value = true
    try {
      const response = await bitbucketApi.getRepos()
      repos.value = response.repos
      if (response.repos.length > 0) {
        selectedRepo.value = response.repos[0]
      }
    } catch {
      repos.value = []
    } finally {
      isLoading.value = false
    }
  },
)

function cancel(): void {
  emit('close')
}

function confirm(): void {
  if (!selectedRepo.value || !props.sourceKey) return
  emit('close')
  router.push({
    name: 'pull-request',
    query: { source: props.sourceKey, repo: selectedRepo.value },
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="cancel"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
        <h2 class="text-base font-semibold text-gray-900">Seleccionar repositorio</h2>
        <p class="text-sm text-gray-600">
          Elige el repositorio donde se creará el pull request para
          <span class="font-mono font-medium text-gray-800">{{ sourceKey }}</span>.
        </p>

        <div v-if="isLoading" class="text-sm text-gray-500">Cargando repositorios...</div>

        <div v-else-if="repos.length === 0" class="text-sm text-red-600">
          No se pudieron cargar los repositorios.
        </div>

        <div v-else>
          <label class="block text-xs font-medium text-gray-600 mb-1">Repositorio</label>
          <select
            v-model="selectedRepo"
            class="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option disabled value="">Selecciona repositorio</option>
            <option v-for="repo in repos" :key="repo" :value="repo">{{ repo }}</option>
          </select>
        </div>

        <div class="flex gap-2 justify-end">
          <button
            class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors"
            @click="cancel"
          >
            Cancelar
          </button>
          <button
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            :disabled="!selectedRepo || isLoading"
            @click="confirm"
          >
            Ir a Pull Request
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

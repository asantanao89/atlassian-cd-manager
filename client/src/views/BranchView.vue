<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { bitbucketApi } from '../api/bitbucketApi'
import { HttpError } from '../api/httpClient'

const route = useRoute()

const BRANCH_TYPES = ['feature', 'bugfix', 'hotfix', 'chore', 'release'] as const
type BranchType = (typeof BRANCH_TYPES)[number]
const STARTPOINT_PRELOADED = ['develop', 'master', 'main']

const issueInput = ref('')
const branchType = ref<BranchType>('feature')
const branchName = ref('')
const selectedRepo = ref('')
const startPoint = ref('develop')
const startPointQuery = ref('develop')
const startPointResults = ref<string[]>([...STARTPOINT_PRELOADED])
const isSearchingStartPoint = ref(false)
const showStartPointDropdown = ref(false)
let startPointDebounce: ReturnType<typeof setTimeout> | null = null

const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const createdBranch = ref<string | null>(null)
const copyFeedback = ref<string | null>(null)
const isCreating = ref(false)

// Pre-fill from query param ?issue=CDPM-123
onMounted(() => {
  const issueParam = route.query.issue
  if (typeof issueParam === 'string' && issueParam.trim()) {
    issueInput.value = issueParam.trim()
  }
})

// Extract CDPM-XXXXX from either a URL or direct code
const extractedCode = computed(() => {
  const match = issueInput.value.match(/CDPM-\d+/i)
  return match ? match[0].toUpperCase() : null
})

const issueError = computed(() =>
  issueInput.value.trim().length > 0 && !extractedCode.value
    ? 'No se encontró un código CDPM-XXXXX válido.'
    : null,
)

const sanitizedName = computed(() =>
  branchName.value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, ''),
)

const branchPreview = computed(() => {
  if (!extractedCode.value || !sanitizedName.value) return null
  return `${branchType.value}/${extractedCode.value}-${sanitizedName.value}`
})

const canSubmit = computed(
  () =>
    !!extractedCode.value &&
    sanitizedName.value.length > 0 &&
    selectedRepo.value.length > 0 &&
    startPoint.value.trim().length > 0,
)

const checkoutCommand = computed(() =>
  createdBranch.value ? `git fetch origin && git checkout ${createdBranch.value}` : null,
)

// Load configured repos
const {
  data: reposData,
  isLoading: isLoadingRepos,
  error: reposError,
} = useQuery({
  queryKey: ['bitbucket-repos'],
  queryFn: () => bitbucketApi.getRepos(),
  retry: 1,
})

// Auto-select first repo when list loads
watch(
  () => reposData.value?.repos,
  (repos) => {
    if (repos && repos.length > 0 && !selectedRepo.value) {
      selectedRepo.value = repos[0]
    }
  },
)

const reposErrorMessage = computed(() => {
  if (!reposError.value) return null
  return reposError.value instanceof HttpError
    ? reposError.value.message
    : 'Error al cargar los repositorios.'
})

function onStartPointInput(): void {
  if (startPointDebounce) clearTimeout(startPointDebounce)
  showStartPointDropdown.value = true
  const q = startPointQuery.value.trim()
  if (q.length < 2) {
    startPointResults.value = STARTPOINT_PRELOADED.filter((b) => b.includes(q.toLowerCase()))
    return
  }
  isSearchingStartPoint.value = true
  startPointDebounce = setTimeout(async () => {
    try {
      const response = await bitbucketApi.getBranches(selectedRepo.value, q)
      startPointResults.value = response.branches
    } catch {
      startPointResults.value = []
    } finally {
      isSearchingStartPoint.value = false
    }
  }, 350)
}

function selectStartPoint(branch: string): void {
  startPoint.value = branch
  startPointQuery.value = branch
  showStartPointDropdown.value = false
}

function handleStartPointBlur(): void {
  setTimeout(() => { showStartPointDropdown.value = false }, 200)
}

function handleSubmit() {
  if (!canSubmit.value || isCreating.value) return

  successMessage.value = null
  errorMessage.value = null
  createdBranch.value = null
  copyFeedback.value = null
  isCreating.value = true

  bitbucketApi
    .createBranch({
      repoSlug: selectedRepo.value,
      name: branchPreview.value!,
      startPoint: startPoint.value.trim(),
    })
    .then((result) => {
      createdBranch.value = result.branch
      successMessage.value = `✅ Rama '${result.branch}' creada correctamente en '${selectedRepo.value}'.`
      issueInput.value = ''
      branchName.value = ''
      branchType.value = 'feature'
      startPoint.value = 'develop'
      startPointQuery.value = 'develop'
      startPointResults.value = [...STARTPOINT_PRELOADED]
    })
    .catch((err: unknown) => {
      if (err instanceof HttpError) {
        errorMessage.value = err.message
      } else {
        errorMessage.value = err instanceof Error ? err.message : 'Error inesperado al crear la rama.'
      }
    })
    .finally(() => {
      isCreating.value = false
    })
}

async function copyCheckoutCommand(): Promise<void> {
  if (!checkoutCommand.value) return

  try {
    await navigator.clipboard.writeText(checkoutCommand.value)
    copyFeedback.value = 'Comando copiado.'
  } catch {
    copyFeedback.value = 'No se pudo copiar. Copia manualmente el comando.'
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-6 space-y-6">
    <h1 class="text-lg font-semibold text-gray-800">Crear Rama</h1>

    <div v-if="reposErrorMessage" class="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      {{ reposErrorMessage }}
    </div>

    <form class="space-y-5" @submit.prevent="handleSubmit">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Issue de Jira <span class="text-gray-400 font-normal">(URL o código CDPM-XXX)</span>
        </label>
        <input
          v-model="issueInput"
          type="text"
          placeholder="https://company.atlassian.net/browse/CDPM-123 o CDPM-123"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          :class="{ 'border-red-400': issueError }"
        />
        <p v-if="issueError" class="mt-1 text-xs text-red-600">{{ issueError }}</p>
        <p v-else-if="extractedCode" class="mt-1 text-xs text-green-600">
          Código detectado: <span class="font-mono font-semibold">{{ extractedCode }}</span>
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de rama</label>
        <select
          v-model="branchType"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option v-for="t in BRANCH_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Nombre de la rama</label>
        <input
          v-model="branchName"
          type="text"
          placeholder="descripción breve del cambio"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Repositorio</label>
        <div v-if="isLoadingRepos" class="text-sm text-gray-400">Cargando repositorios…</div>
        <select
          v-else
          v-model="selectedRepo"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="" disabled>Selecciona un repositorio</option>
          <option v-for="repo in reposData?.repos" :key="repo" :value="repo">{{ repo }}</option>
        </select>
      </div>

      <div class="relative">
        <label class="block text-sm font-medium text-gray-700 mb-1">Rama base</label>
        <input
          v-model="startPointQuery"
          type="text"
          placeholder="Buscar rama base..."
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          :disabled="!selectedRepo"
          @input="onStartPointInput"
          @focus="showStartPointDropdown = true; startPointResults = [...STARTPOINT_PRELOADED]"
          @blur="handleStartPointBlur"
        />
        <p v-if="startPoint && startPoint !== startPointQuery" class="mt-1 text-xs text-green-600">
          Seleccionada: {{ startPoint }}
        </p>
        <p v-if="isSearchingStartPoint" class="mt-1 text-xs text-gray-400">Buscando...</p>
        <ul
          v-if="showStartPointDropdown && startPointResults.length > 0"
          class="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          <li
            v-for="branch in startPointResults"
            :key="`sp-${branch}`"
            class="px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50"
            :class="{ 'bg-blue-100 font-medium': branch === startPoint }"
            @mousedown.prevent="selectStartPoint(branch)"
          >
            {{ branch }}
          </li>
        </ul>
        <p v-if="showStartPointDropdown && startPointQuery.trim().length >= 2 && startPointResults.length === 0 && !isSearchingStartPoint" class="mt-1 text-xs text-gray-400">
          Sin resultados
        </p>
      </div>

      <div v-if="branchPreview" class="rounded-md bg-gray-50 border border-gray-200 px-4 py-3">
        <p class="text-xs text-gray-500 mb-1">Vista previa</p>
        <p class="font-mono text-sm text-gray-800 break-all">{{ branchPreview }}</p>
      </div>

      <button
        type="submit"
        :disabled="!canSubmit || isCreating"
        class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span v-if="isCreating">Creando rama…</span>
        <span v-else>Crear rama</span>
      </button>
    </form>

    <div
      v-if="successMessage"
      class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
    >
      {{ successMessage }}
    </div>

    <div
      v-if="checkoutCommand"
      class="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800"
    >
      <p class="text-xs text-emerald-700 mb-2">Siguiente paso en tu repo local</p>
      <div class="flex flex-col sm:flex-row sm:items-center gap-2">
        <code class="flex-1 rounded bg-emerald-100 px-2 py-1 font-mono text-xs break-all">{{ checkoutCommand }}</code>
        <button
          type="button"
          class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          @click="copyCheckoutCommand"
        >
          Copiar
        </button>
      </div>
      <p v-if="copyFeedback" class="mt-2 text-xs text-emerald-700">{{ copyFeedback }}</p>
    </div>

    <div
      v-if="errorMessage"
      class="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
    >
      {{ errorMessage }}
    </div>
  </div>
</template>

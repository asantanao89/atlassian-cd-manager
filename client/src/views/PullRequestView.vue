<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { HttpError } from '../api/httpClient'
import { bitbucketApi } from '../api/bitbucketApi'
import type { CreatedPullRequest } from '../types/jira'

const route = useRoute()

const TARGET_PRELOADED = ['develop', 'master', 'main', 'staging-1', 'staging-2']

const sourceBranch = ref('')
const targetBranch = ref('')
const title = ref('')
const description = ref('')

const repos = ref<string[]>([])
const repoSlug = ref('')
const isLoadingRepos = ref(false)

// Source branch search
const sourceQuery = ref('')
const sourceResults = ref<string[]>([])
const isSearchingSource = ref(false)
const showSourceDropdown = ref(false)
let sourceDebounce: ReturnType<typeof setTimeout> | null = null

// Target branch search
const targetQuery = ref('')
const targetResults = ref<string[]>([...TARGET_PRELOADED])
const isSearchingTarget = ref(false)
const showTargetDropdown = ref(false)
let targetDebounce: ReturnType<typeof setTimeout> | null = null

const isLoadingCommits = ref(false)

const isCreating = ref(false)
const createError = ref<string | null>(null)
const createdPullRequest = ref<CreatedPullRequest | null>(null)

const canCreate = computed(() => {
  return (
    sourceBranch.value.trim().length > 0
    && targetBranch.value.trim().length > 0
    && sourceBranch.value !== targetBranch.value
    && title.value.trim().length > 0
    && repoSlug.value.length > 0
    && !isCreating.value
  )
})

// Auto-generate title from source branch name
watch(sourceBranch, (branch) => {
  if (!branch) {
    title.value = ''
    return
  }
  title.value = branch
})

// Auto-generate description from commits when both branches are selected
watch([sourceBranch, targetBranch, repoSlug], async ([source, target, repo]) => {
  if (!source || !target || !repo || source === target) {
    description.value = ''
    return
  }

  isLoadingCommits.value = true
  try {
    const response = await bitbucketApi.getCommits(repo, source, target)
    description.value = response.commits
      .map((c) => `- ${c.hash} ${c.message}`)
      .join('\n')
  } catch {
    description.value = ''
  } finally {
    isLoadingCommits.value = false
  }
})

watch(repoSlug, () => {
  sourceBranch.value = ''
  targetBranch.value = ''
  sourceQuery.value = ''
  targetQuery.value = ''
  sourceResults.value = []
  targetResults.value = [...TARGET_PRELOADED]
})

function onSourceInput(): void {
  if (sourceDebounce) clearTimeout(sourceDebounce)
  showSourceDropdown.value = true
  if (sourceQuery.value.trim().length < 2) {
    sourceResults.value = []
    isSearchingSource.value = false
    return
  }
  isSearchingSource.value = true
  sourceDebounce = setTimeout(async () => {
    try {
      const response = await bitbucketApi.getBranches(repoSlug.value, sourceQuery.value.trim())
      sourceResults.value = response.branches
    } catch {
      sourceResults.value = []
    } finally {
      isSearchingSource.value = false
    }
  }, 350)
}

function selectSource(branch: string): void {
  sourceBranch.value = branch
  sourceQuery.value = branch
  showSourceDropdown.value = false
}

function onTargetInput(): void {
  if (targetDebounce) clearTimeout(targetDebounce)
  showTargetDropdown.value = true
  const q = targetQuery.value.trim()
  if (q.length < 2) {
    targetResults.value = q.length === 0
      ? [...TARGET_PRELOADED]
      : TARGET_PRELOADED.filter((b) => b.includes(q.toLowerCase()))
    isSearchingTarget.value = false
    return
  }
  isSearchingTarget.value = true
  targetDebounce = setTimeout(async () => {
    try {
      const response = await bitbucketApi.getBranches(repoSlug.value, q)
      targetResults.value = response.branches
    } catch {
      targetResults.value = []
    } finally {
      isSearchingTarget.value = false
    }
  }, 350)
}

function selectTarget(branch: string): void {
  targetBranch.value = branch
  targetQuery.value = branch
  showTargetDropdown.value = false
}

function handleSourceBlur(): void {
  // Delay to allow click on dropdown item
  setTimeout(() => { showSourceDropdown.value = false }, 200)
}

function handleTargetBlur(): void {
  setTimeout(() => { showTargetDropdown.value = false }, 200)
}

async function loadRepos(): Promise<void> {
  isLoadingRepos.value = true
  try {
    const response = await bitbucketApi.getRepos()
    repos.value = response.repos
    const repoParam = route.query.repo
    if (typeof repoParam === 'string' && repoParam.trim() && response.repos.includes(repoParam.trim())) {
      repoSlug.value = repoParam.trim()
    } else if (response.repos.length > 0 && !repoSlug.value) {
      repoSlug.value = response.repos[0]
    }
  } catch {
    // silent — repos will remain empty
  } finally {
    isLoadingRepos.value = false
  }
}

async function handleCreatePullRequest(): Promise<void> {
  if (!canCreate.value) return

  isCreating.value = true
  createError.value = null
  createdPullRequest.value = null

  try {
    createdPullRequest.value = await bitbucketApi.createPullRequest({
      repoSlug: repoSlug.value,
      sourceBranch: sourceBranch.value,
      targetBranch: targetBranch.value,
      title: title.value.trim(),
      description: description.value.trim() || undefined,
    })
  } catch (error) {
    if (error instanceof HttpError && Array.isArray(error.details) && error.details.length > 0) {
      createError.value = `${error.message}: ${error.details.join(', ')}`
    } else {
      createError.value = error instanceof Error ? error.message : 'No se pudo crear el pull request'
    }
  } finally {
    isCreating.value = false
  }
}

onMounted(async () => {
  await loadRepos()

  // Pre-fill source branch from query param ?source=CDPM-123
  const sourceParam = route.query.source
  if (typeof sourceParam === 'string' && sourceParam.trim() && repoSlug.value) {
    sourceQuery.value = sourceParam.trim()
    try {
      const response = await bitbucketApi.getBranches(repoSlug.value, sourceParam.trim())
      sourceResults.value = response.branches
      showSourceDropdown.value = true
      // Auto-select if only one result
      if (response.branches.length === 1) {
        selectSource(response.branches[0])
      }
    } catch {
      // silent — user can search manually
    }
  }
})
</script>

<template>
  <div class="max-w-screen-xl mx-auto px-4 py-6 space-y-4">
    <div>
      <h1 class="text-lg font-semibold text-gray-800">Pull Request</h1>
      <p class="text-sm text-gray-600">Crear pull request en Bitbucket</p>
    </div>

    <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">
          Repositorio <span class="text-red-500">*</span>
        </label>
        <select
          v-model="repoSlug"
          class="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          :disabled="isLoadingRepos || repos.length === 0"
        >
          <option disabled value="">Selecciona repositorio</option>
          <option v-for="repo in repos" :key="repo" :value="repo">{{ repo }}</option>
        </select>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="relative">
          <label class="block text-xs font-medium text-gray-600 mb-1">
            Rama origen <span class="text-red-500">*</span>
          </label>
          <input
            v-model="sourceQuery"
            type="text"
            placeholder="Buscar rama origen..."
            class="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="!repoSlug"
            @input="onSourceInput"
            @focus="showSourceDropdown = true"
            @blur="handleSourceBlur"
          />
          <p v-if="sourceBranch && sourceBranch !== sourceQuery" class="text-xs text-green-600 mt-0.5">
            Seleccionada: {{ sourceBranch }}
          </p>
          <p v-if="isSearchingSource" class="text-xs text-gray-400 mt-0.5">Buscando...</p>
          <ul
            v-if="showSourceDropdown && sourceResults.length > 0"
            class="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded border border-gray-200 bg-white shadow-lg"
          >
            <li
              v-for="branch in sourceResults"
              :key="`src-${branch}`"
              class="px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50"
              :class="{ 'bg-blue-100 font-medium': branch === sourceBranch }"
              @mousedown.prevent="selectSource(branch)"
            >
              {{ branch }}
            </li>
          </ul>
          <p v-if="showSourceDropdown && sourceQuery.trim().length >= 2 && sourceResults.length === 0 && !isSearchingSource" class="text-xs text-gray-400 mt-0.5">
            Sin resultados
          </p>
        </div>

        <div class="relative">
          <label class="block text-xs font-medium text-gray-600 mb-1">
            Rama target <span class="text-red-500">*</span>
          </label>
          <input
            v-model="targetQuery"
            type="text"
            placeholder="Buscar rama target..."
            class="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="!repoSlug"
            @input="onTargetInput"
            @focus="showTargetDropdown = true"
            @blur="handleTargetBlur"
          />
          <p v-if="targetBranch && targetBranch !== targetQuery" class="text-xs text-green-600 mt-0.5">
            Seleccionada: {{ targetBranch }}
          </p>
          <p v-if="isSearchingTarget" class="text-xs text-gray-400 mt-0.5">Buscando...</p>
          <ul
            v-if="showTargetDropdown && targetResults.length > 0"
            class="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded border border-gray-200 bg-white shadow-lg"
          >
            <li
              v-for="branch in targetResults"
              :key="`tgt-${branch}`"
              class="px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50"
              :class="{ 'bg-blue-100 font-medium': branch === targetBranch }"
              @mousedown.prevent="selectTarget(branch)"
            >
              {{ branch }}
            </li>
          </ul>
          <p v-if="showTargetDropdown && targetQuery.trim().length >= 2 && targetResults.length === 0 && !isSearchingTarget" class="text-xs text-gray-400 mt-0.5">
            Sin resultados
          </p>
        </div>
      </div>

      <div v-if="sourceBranch && targetBranch && sourceBranch === targetBranch" class="text-xs text-red-600">
        Rama origen y rama target deben ser diferentes.
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">
          Título del PR <span class="text-red-500">*</span>
        </label>
        <input
          v-model="title"
          type="text"
          class="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Se genera automáticamente con el nombre de la rama"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">
          Descripción
          <span v-if="isLoadingCommits" class="text-gray-400 font-normal">(cargando commits...)</span>
        </label>
        <textarea
          v-model="description"
          rows="6"
          class="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Se genera automáticamente con los commits entre las ramas"
        />
      </div>

      <div v-if="createError" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
        {{ createError }}
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          :disabled="!canCreate"
          @click="handleCreatePullRequest"
        >
          {{ isCreating ? 'Creando...' : 'Crear Pull Request' }}
        </button>
      </div>
    </div>

    <div v-if="createdPullRequest" class="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
      <h2 class="text-sm font-semibold text-green-800">Pull request creado</h2>
      <p class="text-sm text-gray-700">
        <span class="font-medium">{{ createdPullRequest.title }}</span>
      </p>
      <p class="text-xs text-gray-600">
        {{ createdPullRequest.sourceBranch || '-' }} -> {{ createdPullRequest.targetBranch || '-' }}
      </p>
      <p class="text-xs text-gray-600">Estado: {{ createdPullRequest.state || 'OPEN' }}</p>
      <p class="text-xs text-gray-600">Repositorio: {{ createdPullRequest.repository || repoSlug }}</p>

      <a
        v-if="createdPullRequest.url"
        :href="createdPullRequest.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center text-sm text-blue-700 hover:text-blue-900 underline"
      >
        Abrir pull request
      </a>
    </div>
  </div>
</template>

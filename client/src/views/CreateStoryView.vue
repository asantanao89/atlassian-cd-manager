<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { marked } from 'marked'
import { aiApi } from '../api/aiApi'
import { jiraApi } from '../api/jiraApi'
import { HttpError } from '../api/httpClient'
import AiImprovePromptDialog from '../components/AiImprovePromptDialog.vue'
import ParentEpicSelector from '../components/ParentEpicSelector.vue'
import WorkTypeIcon from '../components/WorkTypeIcon.vue'
import type { CreatedStory, StoryEditorIssue, StoryParentOption, StoryFieldBackup } from '../types/jira'
import type { AiImprovePromptContext, ImproveFieldId } from '../utils/aiImprovePrompt'
import { ACCEPTANCE_CRITERIA_TEMPLATE } from '../utils/aiImprovePrompt'
import { parseJiraIssueKey } from '../utils/parseIssueKey'
import { workTypeBadgeClass } from '../utils/workTypeIcons'

marked.setOptions({ breaks: true, gfm: true })

type EditorMode = 'chooser' | 'clone-select' | 'create' | 'edit' | 'clone'

type CloneFieldId =
  | 'summary'
  | 'description'
  | 'acceptanceCriteria'
  | 'issueType'
  | 'parent'
  | 'components'
  | 'pilares'
  | 'valor'
  | 'storyPoints'

const CLONE_FIELD_OPTIONS: Array<{ id: CloneFieldId; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'description', label: 'Description' },
  { id: 'acceptanceCriteria', label: 'Criterios de Aceptación' },
  { id: 'issueType', label: 'Work type' },
  { id: 'parent', label: 'Parent' },
  { id: 'components', label: 'Components' },
  { id: 'pilares', label: 'Pilares' },
  { id: 'valor', label: 'Valor' },
  { id: 'storyPoints', label: 'Story Points' },
]

function defaultCloneSelection(): Record<CloneFieldId, boolean> {
  return {
    summary: true,
    description: true,
    acceptanceCriteria: true,
    issueType: true,
    parent: true,
    components: true,
    pilares: true,
    valor: true,
    storyPoints: true,
  }
}

const editorMode = ref<EditorMode>('chooser')
const editLookup = ref('')
const cloneLookup = ref('')
const editingKey = ref<string | null>(null)
const editingUrl = ref<string | null>(null)
const clonedFromKey = ref<string | null>(null)
const cloneSource = ref<StoryEditorIssue | null>(null)
const cloneSelection = ref<Record<CloneFieldId, boolean>>(defaultCloneSelection())
const isLoadingIssue = ref(false)
const loadErrorMessage = ref<string | null>(null)
const loadErrorFor = ref<'edit' | 'clone' | null>(null)

const summary = ref('')
const description = ref('')
const issueTypeId = ref('')
const parent = ref<StoryParentOption | null>(null)
const pilarId = ref('')
const componentIds = ref<string[]>([])
const valor = ref('A definir')
const storyPoints = ref('')
const acceptanceCriteria = ref('')
const workTypeMenuOpen = ref(false)

type BackupFieldId = 'summary' | 'description' | 'acceptanceCriteria'

function defaultBackupSelection(): Record<BackupFieldId, boolean> {
  return {
    summary: false,
    description: false,
    acceptanceCriteria: false,
  }
}

const editBackupSnapshot = ref<StoryFieldBackup | null>(null)
const backupInComment = ref<Record<BackupFieldId, boolean>>(defaultBackupSelection())

const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const savedStory = ref<CreatedStory | null>(null)
const openAiFields = ref<ImproveFieldId[]>([])
const previewOpen = ref(false)

const {
  data: options,
  isLoading: isLoadingOptions,
  error: optionsError,
} = useQuery({
  queryKey: ['jira-story-create-options'],
  queryFn: () => jiraApi.getStoryCreateOptions(),
  retry: 1,
})

const {
  data: aiStatus,
  isLoading: isLoadingAiStatus,
  isFetching: isFetchingAiStatus,
} = useQuery({
  queryKey: ['ai-worker-status'],
  queryFn: () => aiApi.getStatus(),
  retry: 1,
  refetchInterval: 15_000,
})

const aiAvailable = computed(() => aiStatus.value?.available === true)
const aiStatusLabel = computed(() => {
  if (isLoadingAiStatus.value && !aiStatus.value) return 'Comprobando AI…'
  if (!aiStatus.value?.configured) return 'AI no configurada'
  if (aiAvailable.value) return 'AI disponible'
  return 'AI no disponible'
})
const aiStatusTitle = computed(() => {
  if (!aiStatus.value?.configured) {
    return 'Define CODEX_WORKER_URL y CODEX_WORKER_TOKEN en el servidor.'
  }
  if (aiAvailable.value) {
    return 'Codex worker alcanzable (túnel + servicio en el laptop).'
  }
  if (aiStatus.value.reason === 'unhealthy') {
    return 'El worker respondió, pero no está sano.'
  }
  return 'Worker o túnel SSH no alcanzable. Arranca make pi y el ssh -R al host de la app.'
})
const aiHelpTooltip = computed(() => {
  if (!aiStatus.value?.configured) {
    return [
      'AI no configurada en el BFF.',
      '',
      '1. En el servidor, añade a server/.env:',
      '   CODEX_WORKER_URL=http://127.0.0.1:9876',
      '   CODEX_WORKER_TOKEN=<mismo token que el laptop>',
      '2. Reinicia el servicio del BFF.',
      '3. En el laptop: make pi (o make pi-install).',
      '4. Túnel: ssh -N -R 127.0.0.1:9876:127.0.0.1:9876 user@APP_HOST',
    ].join('\n')
  }
  return [
    'El Codex worker no responde (servicio o túnel).',
    '',
    'En el laptop:',
    '• make pi  (o make pi-install / make pi-start)',
    '• make pi-status',
    '• curl http://127.0.0.1:9876/health',
    '• ssh -N -R 127.0.0.1:9876:127.0.0.1:9876 user@APP_HOST',
    '',
    'No hace falta ssh -L en la VM si el BFF está en APP_HOST.',
    'Docs: README.md → Codex worker',
  ].join('\n')
})

watch(
  () => options.value,
  (opts) => {
    if (!opts || editorMode.value !== 'create') return
    if (!issueTypeId.value && opts.defaultIssueTypeId) {
      issueTypeId.value = opts.defaultIssueTypeId
    }
    if (opts.components.length > 0 && componentIds.value.length === 0) {
      const web = opts.components.find((c) => c.name.toUpperCase() === 'WEB')
      componentIds.value = [web?.id ?? opts.components[0].id]
    }
  },
)

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (!target?.closest('[data-work-type-menu]')) {
    workTypeMenuOpen.value = false
  }
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && previewOpen.value) {
    previewOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})

const optionsErrorMessage = computed(() => {
  if (!optionsError.value) return null
  return optionsError.value instanceof HttpError
    ? optionsError.value.message
    : 'Error al cargar las opciones de creación.'
})

const isEditMode = computed(() => editorMode.value === 'edit')
const isCloneMode = computed(() => editorMode.value === 'clone')
const isFormMode = computed(
  () =>
    editorMode.value === 'create' ||
    editorMode.value === 'edit' ||
    editorMode.value === 'clone',
)
const pageTitle = computed(() => {
  if (editorMode.value === 'edit' && editingKey.value) return `Editar ${editingKey.value}`
  if (editorMode.value === 'clone-select' && clonedFromKey.value) {
    return `Clonar ${clonedFromKey.value}`
  }
  if (editorMode.value === 'clone' && clonedFromKey.value) {
    return `Clonar desde ${clonedFromKey.value}`
  }
  if (editorMode.value === 'clone') return 'Clonar historia'
  if (editorMode.value === 'create') return 'Crear historia'
  return 'Historias'
})
const selectedCloneFieldCount = computed(
  () => CLONE_FIELD_OPTIONS.filter((f) => cloneSelection.value[f.id]).length,
)

const orderedComponents = computed(() => {
  const list = [...(options.value?.components ?? [])]
  return list.sort((a, b) => {
    const aWeb = a.name.toUpperCase() === 'WEB'
    const bWeb = b.name.toUpperCase() === 'WEB'
    if (aWeb && !bWeb) return -1
    if (!aWeb && bWeb) return 1
    return a.name.localeCompare(b.name)
  })
})

const selectedIssueType = computed(
  () => options.value?.issueTypes.find((t) => t.id === issueTypeId.value) ?? null,
)

const canSelectParent = computed(
  () =>
    !!issueTypeId.value &&
    issueTypeId.value !== (options.value?.epicIssueTypeId ?? '10000'),
)

const selectedComponentNames = computed(() => {
  const list = orderedComponents.value
  return componentIds.value
    .map((id) => list.find((c) => c.id === id)?.name)
    .filter((name): name is string => !!name)
})

const selectedComponentName = computed(() =>
  selectedComponentNames.value.length > 0
    ? selectedComponentNames.value.join(', ')
    : null,
)

const selectedPilar = computed(
  () => options.value?.pilares.find((p) => p.id === pilarId.value) ?? null,
)

const previewSummary = computed(() => summary.value.trim() || 'Sin título')
const previewDescriptionHtml = computed(() => {
  const md = description.value.trim()
  if (!md) return ''
  return marked.parse(md, { async: false }) as string
})
const previewValor = computed(() => valor.value.trim() || '—')
const previewAcceptanceHtml = computed(() => {
  const md = acceptanceCriteria.value.trim()
  if (!md) return ''
  return marked.parse(md, { async: false }) as string
})
const storyPointsError = computed(() => {
  const raw = storyPoints.value.trim()
  if (!raw) return null
  if (!/^\d+$/.test(raw)) return 'Story Points debe ser un número entero ≥ 0.'
  return null
})
const parsedStoryPoints = computed(() => {
  const raw = storyPoints.value.trim()
  if (!raw || storyPointsError.value) return null
  return Number.parseInt(raw, 10)
})
const selectedIssueTypeBadgeClass = computed(() =>
  workTypeBadgeClass(selectedIssueType.value?.name ?? ''),
)
const previewIssueKey = computed(() =>
  isEditMode.value && editingKey.value
    ? editingKey.value
    : `${options.value?.projectKey ?? 'CDPM'}-????`,
)

const aiImproveContext = computed<AiImprovePromptContext>(() => ({
  summary: summary.value,
  description: description.value,
  acceptanceCriteria: acceptanceCriteria.value,
  componentName: selectedComponentName.value,
  valor: valor.value,
  projectKey: options.value?.projectKey ?? '',
  projectName: options.value?.projectName ?? '',
  issueTypeName: selectedIssueType.value?.name ?? '',
  unOptionValue: options.value?.unOptionValue ?? '',
}))

const canSubmit = computed(
  () =>
    isFormMode.value &&
    summary.value.trim().length > 0 &&
    issueTypeId.value.length > 0 &&
    componentIds.value.length > 0 &&
    valor.value.trim().length > 0 &&
    !storyPointsError.value &&
    !isSaving.value,
)

const submitButtonLabel = computed(() => {
  if (isSaving.value) {
    if (isEditMode.value) return 'Actualizando…'
    if (isCloneMode.value) return 'Creando clon…'
    return 'Creando…'
  }
  if (isEditMode.value) return 'Actualizar historia'
  if (isCloneMode.value) return 'Crear clon'
  return 'Crear historia'
})

function clearFormFields(): void {
  summary.value = ''
  description.value = ''
  valor.value = 'A definir'
  storyPoints.value = ''
  acceptanceCriteria.value = ''
  parent.value = null
  pilarId.value = ''
  openAiFields.value = []
  workTypeMenuOpen.value = false
  errorMessage.value = null
  savedStory.value = null
  editBackupSnapshot.value = null
  backupInComment.value = defaultBackupSelection()
  if (options.value?.defaultIssueTypeId) {
    issueTypeId.value = options.value.defaultIssueTypeId
  } else {
    issueTypeId.value = ''
  }
  if (options.value?.components?.length) {
    const web = options.value.components.find((c) => c.name.toUpperCase() === 'WEB')
    componentIds.value = [web?.id ?? options.value.components[0].id]
  } else {
    componentIds.value = []
  }
}

function backToChooser(): void {
  editorMode.value = 'chooser'
  editingKey.value = null
  editingUrl.value = null
  clonedFromKey.value = null
  cloneSource.value = null
  cloneSelection.value = defaultCloneSelection()
  editLookup.value = ''
  cloneLookup.value = ''
  loadErrorMessage.value = null
  loadErrorFor.value = null
  previewOpen.value = false
  clearFormFields()
}

function startCreate(): void {
  clearFormFields()
  editingKey.value = null
  editingUrl.value = null
  clonedFromKey.value = null
  cloneSource.value = null
  cloneSelection.value = defaultCloneSelection()
  loadErrorMessage.value = null
  loadErrorFor.value = null
  editorMode.value = 'create'
}

function cloneFieldPreview(field: CloneFieldId, issue: StoryEditorIssue): string {
  switch (field) {
    case 'summary':
      return issue.summary.trim() || '—'
    case 'description':
      return issue.description.trim() || '—'
    case 'acceptanceCriteria':
      return issue.acceptanceCriteria.trim() || '—'
    case 'issueType':
      return issue.issueTypeName || issue.issueTypeId || '—'
    case 'parent':
      return issue.parentKey
        ? `${issue.parentKey}${issue.parentSummary ? ` · ${issue.parentSummary}` : ''}`
        : '—'
    case 'components': {
      const names = issue.componentIds
        .map((id) => options.value?.components.find((c) => c.id === id)?.name ?? id)
        .join(', ')
      return names || '—'
    }
    case 'pilares':
      return issue.pilarValue || issue.pilarId || '—'
    case 'valor':
      return issue.valor.trim() || '—'
    case 'storyPoints':
      return issue.storyPoints !== null ? String(issue.storyPoints) : '—'
  }
}

function setAllCloneFields(selected: boolean): void {
  const next = defaultCloneSelection()
  for (const field of CLONE_FIELD_OPTIONS) {
    next[field.id] = selected
  }
  cloneSelection.value = next
}

function applyCloneSelection(): void {
  const issue = cloneSource.value
  if (!issue) return

  clearFormFields()
  const selected = cloneSelection.value

  if (selected.summary) summary.value = issue.summary
  if (selected.description) description.value = issue.description
  if (selected.acceptanceCriteria) acceptanceCriteria.value = issue.acceptanceCriteria
  if (selected.issueType) issueTypeId.value = issue.issueTypeId
  if (selected.components && issue.componentIds.length) {
    componentIds.value = issue.componentIds
  }
  if (selected.pilares) pilarId.value = issue.pilarId ?? ''
  if (selected.valor) valor.value = issue.valor || 'A definir'
  if (selected.storyPoints) {
    storyPoints.value = issue.storyPoints !== null ? String(issue.storyPoints) : ''
  }
  if (selected.parent && issue.parentKey) {
    parent.value = {
      id: '',
      key: issue.parentKey,
      summary: issue.parentSummary ?? issue.parentKey,
      statusName: '',
      statusCategoryKey: '',
      statusColorName: '',
    }
  } else if (
    selected.issueType &&
    issue.issueTypeId === (options.value?.epicIssueTypeId ?? '10000')
  ) {
    parent.value = null
  }

  if (
    issueTypeId.value === (options.value?.epicIssueTypeId ?? '10000')
  ) {
    parent.value = null
  }

  editingKey.value = null
  editingUrl.value = null
  clonedFromKey.value = issue.key
  editorMode.value = 'clone'
}

async function loadIssue(intent: 'edit' | 'clone'): Promise<void> {
  const raw = intent === 'edit' ? editLookup.value : cloneLookup.value
  const key = parseJiraIssueKey(raw)
  if (!key) {
    loadErrorFor.value = intent
    loadErrorMessage.value = 'Introduce una clave (CDPM-123) o una URL de Jira válida.'
    return
  }

  isLoadingIssue.value = true
  loadErrorFor.value = intent
  loadErrorMessage.value = null
  errorMessage.value = null
  savedStory.value = null

  try {
    const issue = await jiraApi.getStoryForEdit(key)

    if (intent === 'edit') {
      summary.value = issue.summary
      description.value = issue.description
      issueTypeId.value = issue.issueTypeId
      componentIds.value = issue.componentIds.length
        ? issue.componentIds
        : options.value?.components[0]
          ? [options.value.components[0].id]
          : []
      valor.value = issue.valor || 'A definir'
      pilarId.value = issue.pilarId ?? ''
      storyPoints.value = issue.storyPoints !== null ? String(issue.storyPoints) : ''
      acceptanceCriteria.value = issue.acceptanceCriteria
      parent.value = issue.parentKey
        ? {
            id: '',
            key: issue.parentKey,
            summary: issue.parentSummary ?? issue.parentKey,
            statusName: '',
            statusCategoryKey: '',
            statusColorName: '',
          }
        : null
      editBackupSnapshot.value = {
        summary: issue.summary,
        description: issue.description,
        acceptanceCriteria: issue.acceptanceCriteria,
      }
      backupInComment.value = defaultBackupSelection()
      editingKey.value = issue.key
      editingUrl.value = issue.url
      clonedFromKey.value = null
      cloneSource.value = null
      editorMode.value = 'edit'
    } else {
      cloneSource.value = issue
      cloneSelection.value = defaultCloneSelection()
      editingKey.value = null
      editingUrl.value = null
      clonedFromKey.value = issue.key
      editBackupSnapshot.value = null
      backupInComment.value = defaultBackupSelection()
      editorMode.value = 'clone-select'
    }
  } catch (err) {
    loadErrorFor.value = intent
    loadErrorMessage.value =
      err instanceof HttpError ? err.message : 'No se pudo cargar el issue.'
  } finally {
    isLoadingIssue.value = false
  }
}

function selectIssueType(id: string): void {
  issueTypeId.value = id
  workTypeMenuOpen.value = false
  if (id === (options.value?.epicIssueTypeId ?? '10000')) {
    parent.value = null
  }
}

function toggleComponent(id: string, checked: boolean): void {
  if (checked) {
    if (!componentIds.value.includes(id)) {
      componentIds.value = [...componentIds.value, id]
    }
    return
  }
  componentIds.value = componentIds.value.filter((current) => current !== id)
}

function openAiImprove(field: ImproveFieldId): void {
  if (!aiAvailable.value) return
  if (!openAiFields.value.includes(field)) {
    openAiFields.value = [...openAiFields.value, field]
  }
}

function applyDescriptionTemplate(): void {
  const component = selectedComponentName.value?.trim() || 'seleccionado'
  description.value = [
    '## 1. Objetivo',
    '',
    `[Completar: definir el objetivo concreto de la historia para el componente ${component}.]`,
    '',
    '## 2. Descripción funcional',
    '',
    '[Completar: describir la funcionalidad, cambio o necesidad que debe cubrir la historia.]',
    '',
    '## 3. Alcance',
    '',
    '[Completar: especificar qué queda incluido y, si aplica, qué queda fuera del alcance.]',
    '',
    '## 4. Impacto / Dependencias',
    '',
    '',
    '## 5. Información adicional',
    '',
    '',
  ].join('\n')
}

function applyAcceptanceCriteriaTemplate(): void {
  acceptanceCriteria.value = ACCEPTANCE_CRITERIA_TEMPLATE
}

function closeAiImprove(field: ImproveFieldId): void {
  openAiFields.value = openAiFields.value.filter((f) => f !== field)
}

function onAiImproveApply(field: ImproveFieldId, improvedValue: string): void {
  if (field === 'summary') {
    summary.value = improvedValue
  } else if (field === 'description') {
    description.value = improvedValue
  } else if (field === 'acceptanceCriteria') {
    acceptanceCriteria.value = improvedValue
  }
  closeAiImprove(field)
}

function buildPayload() {
  return {
    summary: summary.value.trim(),
    issueTypeId: issueTypeId.value,
    componentIds: componentIds.value,
    valor: valor.value.trim(),
    description: description.value.trim() || undefined,
    parentKey: canSelectParent.value ? parent.value?.key ?? null : null,
    pilarId: pilarId.value || null,
    storyPoints: parsedStoryPoints.value,
    acceptanceCriteria: acceptanceCriteria.value.trim() || null,
  }
}

function buildFieldBackup(): StoryFieldBackup | undefined {
  const snapshot = editBackupSnapshot.value
  if (!snapshot) return undefined

  const backup: StoryFieldBackup = {}

  if (backupInComment.value.summary) {
    const original = (snapshot.summary ?? '').trim()
    const current = summary.value.trim()
    if (original && original !== current) backup.summary = original
  }
  if (backupInComment.value.description) {
    const original = (snapshot.description ?? '').trim()
    const current = description.value.trim()
    if (original && original !== current) backup.description = original
  }
  if (backupInComment.value.acceptanceCriteria) {
    const original = (snapshot.acceptanceCriteria ?? '').trim()
    const current = acceptanceCriteria.value.trim()
    if (original && original !== current) backup.acceptanceCriteria = original
  }

  return Object.keys(backup).length > 0 ? backup : undefined
}

async function handleSubmit(): Promise<void> {
  if (!canSubmit.value) return

  isSaving.value = true
  errorMessage.value = null
  savedStory.value = null

  try {
    const payload = buildPayload()
    if (isEditMode.value && editingKey.value) {
      const fieldBackup = buildFieldBackup()
      savedStory.value = await jiraApi.updateStory(editingKey.value, {
        ...payload,
        ...(fieldBackup ? { fieldBackup } : {}),
      })
      editBackupSnapshot.value = {
        summary: summary.value,
        description: description.value,
        acceptanceCriteria: acceptanceCriteria.value,
      }
      backupInComment.value = defaultBackupSelection()
    } else {
      savedStory.value = await jiraApi.createStory(payload)
    }
  } catch (err) {
    errorMessage.value =
      err instanceof HttpError
        ? err.message
        : isEditMode.value
          ? 'No se pudo actualizar el issue.'
          : 'No se pudo crear el issue.'
  } finally {
    isSaving.value = false
  }
}

function afterSaveContinue(): void {
  if (isEditMode.value) {
    savedStory.value = null
    return
  }
  clearFormFields()
  clonedFromKey.value = null
  cloneSource.value = null
  cloneSelection.value = defaultCloneSelection()
  savedStory.value = null
  if (isCloneMode.value) {
    editorMode.value = 'chooser'
    cloneLookup.value = ''
  }
}

const saveSuccessTitle = computed(() => {
  if (isEditMode.value) return 'Issue actualizado'
  if (isCloneMode.value) return 'Clon creado'
  return `${selectedIssueType.value?.name ?? 'Issue'} creado`
})

const saveContinueLabel = computed(() => {
  if (isEditMode.value) return 'Seguir editando'
  if (isCloneMode.value) return 'Clonar otra'
  return 'Crear otra'
})
</script>

<template>
  <div class="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
    <div class="flex items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-lg font-semibold text-gray-800">{{ pageTitle }}</h1>
        <span
          v-if="options && isFormMode"
          class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
          :class="
            aiAvailable
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          "
          :title="aiAvailable ? aiStatusTitle : undefined"
        >
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="
              aiAvailable
                ? 'bg-green-500'
                : isFetchingAiStatus
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-amber-500'
            "
          />
          {{ aiStatusLabel }}
          <span
            v-if="!aiAvailable && !isLoadingAiStatus"
            class="group relative inline-flex"
          >
            <button
              type="button"
              class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-400 text-[10px] font-bold leading-none text-amber-800 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label="Cómo comprobar o configurar AI"
            >
              ?
            </button>
            <span
              role="tooltip"
              class="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 whitespace-pre-line rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-gray-700 shadow-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {{ aiHelpTooltip }}
            </span>
          </span>
        </span>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <button
          v-if="options && isFormMode"
          type="button"
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          @click="previewOpen = true"
        >
          Vista previa
        </button>
        <button
          v-if="options && isFormMode"
          type="button"
          class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ submitButtonLabel }}
        </button>
        <button
          v-if="editorMode !== 'chooser'"
          type="button"
          class="text-sm text-gray-600 underline hover:text-gray-900"
          @click="backToChooser"
        >
          Cambiar modo
        </button>
      </div>
    </div>

    <div
      v-if="optionsErrorMessage"
      class="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
    >
      {{ optionsErrorMessage }}
    </div>

    <div v-if="isLoadingOptions" class="text-sm text-gray-400">Cargando opciones…</div>

    <div
      v-else-if="options && editorMode === 'chooser'"
      class="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      <button
        type="button"
        class="flex h-full flex-col justify-start rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
        @click="startCreate"
      >
        <p class="text-sm font-semibold text-gray-900">Crear nueva</p>
        <p class="mt-1 text-sm text-gray-500">
          Abre el formulario vacío para crear un issue en CDPM.
        </p>
      </button>

      <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <div>
          <p class="text-sm font-semibold text-gray-900">Editar existente</p>
          <p class="mt-1 text-sm text-gray-500">
            Carga por clave (<span class="font-mono text-xs">CDPM-123</span>) o URL de Jira.
          </p>
        </div>
        <input
          v-model="editLookup"
          type="text"
          placeholder="CDPM-123 o https://…/browse/CDPM-123"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          @keydown.enter.prevent="loadIssue('edit')"
        />
        <p v-if="loadErrorFor === 'edit' && loadErrorMessage" class="text-xs text-red-600">
          {{ loadErrorMessage }}
        </p>
        <button
          type="button"
          class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="isLoadingIssue || !editLookup.trim()"
          @click="loadIssue('edit')"
        >
          {{ isLoadingIssue && loadErrorFor !== 'clone' ? 'Cargando…' : 'Cargar issue' }}
        </button>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <div>
          <p class="text-sm font-semibold text-gray-900">Clonar</p>
          <p class="mt-1 text-sm text-gray-500">
            Copia los datos de otra historia y crea una nueva.
          </p>
        </div>
        <input
          v-model="cloneLookup"
          type="text"
          placeholder="URL o clave a clonar"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          @keydown.enter.prevent="loadIssue('clone')"
        />
        <p v-if="loadErrorFor === 'clone' && loadErrorMessage" class="text-xs text-red-600">
          {{ loadErrorMessage }}
        </p>
        <button
          type="button"
          class="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="isLoadingIssue || !cloneLookup.trim()"
          @click="loadIssue('clone')"
        >
          {{ isLoadingIssue && loadErrorFor === 'clone' ? 'Cargando…' : 'Clonar issue' }}
        </button>
      </div>
    </div>

    <div
      v-else-if="options && editorMode === 'clone-select' && cloneSource"
      class="max-w-3xl space-y-4"
    >
      <div class="rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
        Issue origen:
        <span class="font-mono font-semibold">{{ cloneSource.key }}</span>
        <span class="text-indigo-700"> · elige qué campos copiar al nuevo issue</span>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div class="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <p class="text-sm font-medium text-gray-800">
            Campos a clonar
            <span class="font-normal text-gray-500">
              ({{ selectedCloneFieldCount }}/{{ CLONE_FIELD_OPTIONS.length }})
            </span>
          </p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-xs text-blue-700 underline hover:text-blue-900"
              @click="setAllCloneFields(true)"
            >
              Todos
            </button>
            <button
              type="button"
              class="text-xs text-gray-600 underline hover:text-gray-900"
              @click="setAllCloneFields(false)"
            >
              Ninguno
            </button>
          </div>
        </div>

        <ul class="divide-y divide-gray-100">
          <li
            v-for="field in CLONE_FIELD_OPTIONS"
            :key="field.id"
            class="flex items-start gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <input
              :id="`clone-field-${field.id}`"
              v-model="cloneSelection[field.id]"
              type="checkbox"
              class="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label :for="`clone-field-${field.id}`" class="min-w-0 flex-1 cursor-pointer">
              <span class="block text-sm font-medium text-gray-800">{{ field.label }}</span>
              <span class="mt-0.5 block text-xs text-gray-500 line-clamp-2 break-words">
                {{ cloneFieldPreview(field.id, cloneSource) }}
              </span>
            </label>
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          @click="backToChooser"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="selectedCloneFieldCount === 0"
          @click="applyCloneSelection"
        >
          Continuar al formulario
        </button>
      </div>
    </div>

    <div v-else-if="options && isFormMode">
      <form class="space-y-5" @submit.prevent="handleSubmit">
        <div
          v-if="isCloneMode && clonedFromKey"
          class="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900"
        >
          Clonando
          <span class="font-mono font-semibold">{{ clonedFromKey }}</span>
          (campos seleccionados). Al guardar se creará un issue nuevo.
        </div>
        <div>
          <div class="flex items-center justify-between gap-2 mb-1">
            <div class="min-w-0">
              <label class="block text-sm font-medium text-gray-700">
                Summary <span class="text-red-500">*</span>
              </label>
              <label
                v-if="isEditMode"
                class="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer"
              >
                <input
                  v-model="backupInComment.summary"
                  type="checkbox"
                  class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Backup en comentario
              </label>
            </div>
            <button
              type="button"
              class="shrink-0 rounded px-2 py-0.5 text-xs font-semibold tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :title="aiAvailable ? 'Mejorar Summary con AI' : aiStatusTitle"
              :disabled="!aiAvailable || openAiFields.includes('summary')"
              @click="openAiImprove('summary')"
            >
              AI
            </button>
          </div>
          <AiImprovePromptDialog
            v-if="openAiFields.includes('summary')"
            field="summary"
            :context="aiImproveContext"
            @close="closeAiImprove('summary')"
            @apply="(value) => onAiImproveApply('summary', value)"
          />
          <textarea
            v-model="summary"
            required
            rows="3"
            placeholder="Título de la historia"
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>

        <div>
          <div class="flex items-center justify-between gap-2 mb-1">
            <div class="min-w-0">
              <label class="block text-sm font-medium text-gray-700">Description</label>
              <label
                v-if="isEditMode"
                class="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer"
              >
                <input
                  v-model="backupInComment.description"
                  type="checkbox"
                  class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Backup en comentario
              </label>
            </div>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="shrink-0 rounded px-2 py-0.5 text-xs font-semibold tracking-wide bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors"
                title="Rellenar Description con plantilla"
                @click="applyDescriptionTemplate"
              >
                Template
              </button>
              <button
                type="button"
                class="shrink-0 rounded px-2 py-0.5 text-xs font-semibold tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :title="aiAvailable ? 'Mejorar Description con AI' : aiStatusTitle"
                :disabled="!aiAvailable || openAiFields.includes('description')"
                @click="openAiImprove('description')"
              >
                AI
              </button>
            </div>
          </div>
          <AiImprovePromptDialog
            v-if="openAiFields.includes('description')"
            field="description"
            :context="aiImproveContext"
            @close="closeAiImprove('description')"
            @apply="(value) => onAiImproveApply('description', value)"
          />
          <textarea
            v-model="description"
            rows="18"
            placeholder="Markdown: ## 1. Objetivo, listas, **negrita**…"
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <div class="flex items-center justify-between gap-2 mb-1">
            <div class="min-w-0">
              <label class="block text-sm font-medium text-gray-700">
                Criterios de Aceptación
              </label>
              <label
                v-if="isEditMode"
                class="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer"
              >
                <input
                  v-model="backupInComment.acceptanceCriteria"
                  type="checkbox"
                  class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Backup en comentario
              </label>
            </div>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="shrink-0 rounded px-2 py-0.5 text-xs font-semibold tracking-wide bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors"
                title="Insertar plantilla de tabla"
                @click="applyAcceptanceCriteriaTemplate"
              >
                Template
              </button>
              <button
                type="button"
                class="shrink-0 rounded px-2 py-0.5 text-xs font-semibold tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :title="
                  aiAvailable ? 'Generar tabla con AI a partir de una lista' : aiStatusTitle
                "
                :disabled="!aiAvailable || openAiFields.includes('acceptanceCriteria')"
                @click="openAiImprove('acceptanceCriteria')"
              >
                AI
              </button>
            </div>
          </div>
          <p class="mb-2 text-xs text-gray-500">
            Rellenar un listado para enviar a IA, vaciar completo si se quiere enviar a IA basado
            en título y descripción, o rellenar con tabla a mano.
          </p>
          <AiImprovePromptDialog
            v-if="openAiFields.includes('acceptanceCriteria')"
            field="acceptanceCriteria"
            :context="aiImproveContext"
            @close="closeAiImprove('acceptanceCriteria')"
            @apply="(value) => onAiImproveApply('acceptanceCriteria', value)"
          />
          <textarea
            v-model="acceptanceCriteria"
            rows="10"
            placeholder="Lista o tabla Markdown de criterios de aceptación"
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="rounded-md bg-gray-50 border border-gray-200 px-4 py-3 space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <span class="text-gray-500">Project</span>
              <span class="text-gray-800 text-right">
                {{ options.projectName }}
                <span class="font-mono text-xs text-gray-500">({{ options.projectKey }})</span>
              </span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-gray-500">UN</span>
              <span class="text-gray-800">{{ options.unOptionValue }}</span>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Work type <span class="text-red-500">*</span>
            </label>
            <div class="relative" data-work-type-menu>
              <button
                type="button"
                class="w-full flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                :aria-expanded="workTypeMenuOpen"
                @click.stop="workTypeMenuOpen = !workTypeMenuOpen"
              >
                <span class="flex items-center gap-2 min-w-0">
                  <WorkTypeIcon
                    v-if="selectedIssueType"
                    :name="selectedIssueType.name"
                    size="md"
                  />
                  <span class="truncate text-gray-800">
                    {{ selectedIssueType?.name ?? 'Seleccionar work type' }}
                  </span>
                </span>
                <svg
                  class="h-4 w-4 shrink-0 text-gray-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>

              <ul
                v-if="workTypeMenuOpen"
                class="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                role="listbox"
              >
                <li v-for="type in options.issueTypes" :key="type.id">
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
                    :class="{ 'bg-blue-50': type.id === issueTypeId }"
                    role="option"
                    :aria-selected="type.id === issueTypeId"
                    @click="selectIssueType(type.id)"
                  >
                    <WorkTypeIcon :name="type.name" size="md" />
                    <span class="text-gray-800">{{ type.name }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div v-if="canSelectParent">
            <label class="block text-sm font-medium text-gray-700 mb-1">Parent</label>
            <ParentEpicSelector v-model="parent" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Pilares</label>
            <select
              v-model="pilarId"
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option v-for="pilar in options.pilares" :key="pilar.id" :value="pilar.id">
                {{ pilar.value }}
              </option>
            </select>
          </div>

          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Components <span class="text-red-500">*</span>
            </label>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="c in orderedComponents"
                :key="c.id"
                class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer transition-colors"
                :class="
                  componentIds.includes(c.id)
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                "
              >
                <input
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  :checked="componentIds.includes(c.id)"
                  @change="toggleComponent(c.id, ($event.target as HTMLInputElement).checked)"
                />
                {{ c.name }}
              </label>
            </div>
            <p v-if="componentIds.length === 0" class="mt-1 text-xs text-red-600">
              Selecciona al menos un component.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Valor <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="valor"
              required
              rows="4"
              placeholder="Describe el valor de la historia"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Story Points</label>
            <input
              v-model="storyPoints"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="ej. 3"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              :class="{ 'border-red-400 focus:border-red-500 focus:ring-red-500': storyPointsError }"
            />
            <p class="mt-1 text-xs text-gray-500">
              Measurement of complexity and/or size of a requirement.
            </p>
            <p v-if="storyPointsError" class="mt-1 text-xs text-red-600">{{ storyPointsError }}</p>
          </div>
        </div>

        <div
          v-if="errorMessage"
          class="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {{ errorMessage }}
        </div>
      </form>

      <Teleport to="body">
        <div
          v-if="savedStory"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          @click.self="afterSaveContinue"
        >
          <div
            class="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-save-success-title"
          >
            <div class="border-b border-green-100 bg-green-50 px-4 py-3">
              <h2 id="story-save-success-title" class="text-sm font-semibold text-green-900">
                {{ saveSuccessTitle }}
              </h2>
            </div>
            <div class="px-4 py-4 space-y-4 text-sm text-gray-800">
              <p>
                Issue:
                <a
                  v-if="savedStory.url"
                  :href="savedStory.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-mono font-semibold text-green-800 underline hover:text-green-950"
                >
                  {{ savedStory.key }}
                </a>
                <span v-else class="font-mono font-semibold">{{ savedStory.key }}</span>
              </p>
              <div class="flex flex-wrap items-center justify-end gap-2">
                <a
                  v-if="savedStory.url"
                  :href="savedStory.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Abrir en Jira
                </a>
                <button
                  type="button"
                  class="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800"
                  @click="afterSaveContinue"
                >
                  {{ saveContinueLabel }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <Teleport to="body">
        <div
          v-if="previewOpen"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          @click.self="previewOpen = false"
        >
          <div
            class="bg-white rounded-lg shadow-xl w-full max-w-screen-xl max-h-[90vh] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-preview-title"
          >
            <div class="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2.5 shrink-0">
              <h2 id="story-preview-title" class="text-sm font-semibold text-gray-700">
                Vista previa
              </h2>
              <button
                type="button"
                class="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                aria-label="Cerrar vista previa"
                @click="previewOpen = false"
              >
                Cerrar
              </button>
            </div>

            <div class="p-5 space-y-4 overflow-y-auto min-h-0">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium"
                  :class="selectedIssueTypeBadgeClass"
                >
                  <WorkTypeIcon
                    v-if="selectedIssueType"
                    :name="selectedIssueType.name"
                    size="sm"
                  />
                  {{ selectedIssueType?.name ?? '—' }}
                </span>
                <span class="font-mono text-xs text-gray-400">{{ previewIssueKey }}</span>
              </div>

              <h3
                class="text-xl font-semibold text-gray-900 leading-snug break-words"
                :class="{ 'text-gray-400 italic font-normal': !summary.trim() }"
              >
                {{ previewSummary }}
              </h3>

              <div class="text-sm">
                <div class="text-xs font-medium text-gray-500 mb-1">Description</div>
                <div
                  v-if="previewDescriptionHtml"
                  class="markdown-preview text-gray-800 break-words min-w-0"
                  v-html="previewDescriptionHtml"
                />
                <div v-else class="text-gray-400 italic">—</div>
              </div>

              <div class="text-sm">
                <div class="text-xs font-medium text-gray-500 mb-1">Criterios de Aceptación</div>
                <div
                  v-if="previewAcceptanceHtml"
                  class="markdown-preview text-gray-800 break-words min-w-0 overflow-x-auto"
                  v-html="previewAcceptanceHtml"
                />
                <div v-else class="text-gray-400 italic">—</div>
              </div>

              <dl class="space-y-3.5 text-sm">
                <div class="grid grid-cols-2 gap-x-4 gap-y-3.5">
                  <div>
                    <dt class="text-xs font-medium text-gray-500 mb-1">Status</dt>
                    <dd>
                      <span
                        class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                      >
                        Backlog
                      </span>
                    </dd>
                  </div>

                  <div>
                    <dt class="text-xs font-medium text-gray-500 mb-1">UN</dt>
                    <dd class="text-gray-800">{{ options.unOptionValue }}</dd>
                  </div>

                  <div class="col-span-2">
                    <dt class="text-xs font-medium text-gray-500 mb-1">Project</dt>
                    <dd class="text-gray-800 break-words">{{ options.projectName }}</dd>
                  </div>

                  <div v-if="canSelectParent" class="col-span-2">
                    <dt class="text-xs font-medium text-gray-500 mb-1">Parent</dt>
                    <dd v-if="parent" class="text-gray-800">
                      <div class="flex items-start gap-2">
                        <WorkTypeIcon name="Epica" size="sm" class="mt-0.5" />
                        <div class="min-w-0">
                          <div class="font-mono text-xs text-gray-500">{{ parent.key }}</div>
                          <div class="break-words">{{ parent.summary }}</div>
                        </div>
                      </div>
                    </dd>
                    <dd v-else class="text-gray-400">—</dd>
                  </div>

                  <div class="col-span-2">
                    <dt class="text-xs font-medium text-gray-500 mb-1">Components</dt>
                    <dd class="text-gray-800">
                      <div v-if="selectedComponentNames.length > 0" class="flex flex-wrap gap-1">
                        <span
                          v-for="name in selectedComponentNames"
                          :key="name"
                          class="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800"
                        >
                          {{ name }}
                        </span>
                      </div>
                      <span v-else class="text-gray-400">—</span>
                    </dd>
                  </div>

                  <div class="col-span-2">
                    <dt class="text-xs font-medium text-gray-500 mb-1">Pilares</dt>
                    <dd class="text-gray-800" :class="{ 'text-gray-400': !selectedPilar }">
                      {{ selectedPilar?.value ?? '—' }}
                    </dd>
                  </div>
                </div>

                <div>
                  <dt class="text-xs font-medium text-gray-500 mb-1">Valor</dt>
                  <dd
                    class="text-gray-800 whitespace-pre-wrap break-words"
                    :class="{ 'text-gray-400 italic': !valor.trim() }"
                  >
                    {{ previewValor }}
                  </dd>
                </div>

                <div>
                  <dt class="text-xs font-medium text-gray-500 mb-1">Story Points</dt>
                  <dd class="text-gray-800" :class="{ 'text-gray-400': parsedStoryPoints === null }">
                    {{ parsedStoryPoints ?? '—' }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
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

.markdown-preview :deep(h1) {
  font-size: 1.125rem;
}

.markdown-preview :deep(h2) {
  font-size: 1rem;
}

.markdown-preview :deep(h3),
.markdown-preview :deep(h4) {
  font-size: 0.875rem;
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

.markdown-preview :deep(em) {
  font-style: italic;
}

.markdown-preview :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  background: #f3f4f6;
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
}

.markdown-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  margin: 0.35rem 0;
}

.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 0.35rem 0.5rem;
  text-align: left;
  vertical-align: top;
}

.markdown-preview :deep(th) {
  background: #f3f4f6;
  font-weight: 600;
  color: #374151;
}

.markdown-preview :deep(> :first-child) {
  margin-top: 0;
}
</style>

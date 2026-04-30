<script setup lang="ts">
defineProps<{
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="emit('cancel')"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
        <h2 class="text-base font-semibold text-gray-900">{{ title }}</h2>
        <p class="text-sm text-gray-600">{{ message }}</p>
        <div class="flex gap-2 justify-end">
          <button
            class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors"
            @click="emit('cancel')"
          >
            {{ cancelLabel ?? 'Cancelar' }}
          </button>
          <button
            class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
            :disabled="isLoading"
            @click="emit('confirm')"
          >
            {{ isLoading ? 'Procesando...' : (confirmLabel ?? 'Confirmar') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import SprintStoriesTable from '../components/SprintStoriesTable.vue'
import { useSprintStories } from '../composables/useSprintStories'

const { stories, sprintName, isLoading, errorMessage, refetch } = useSprintStories()
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-800">
        Sprint
        <span v-if="sprintName" class="font-normal text-gray-500">· {{ sprintName }}</span>
      </h1>
      <button
        class="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        @click="() => refetch()"
      >
        Actualizar
      </button>
    </div>

    <SprintStoriesTable
      :stories="stories"
      :is-loading="isLoading"
      :error="errorMessage"
    />
  </div>
</template>

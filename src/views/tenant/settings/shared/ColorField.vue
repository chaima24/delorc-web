<script setup lang="ts">
import DlInput from '@/components/DlInput.vue'

/** Hex colour: type it, or pick it with the swatch. */
defineProps<{
  label: string
  error?: string
  disabled?: boolean
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <DlInput v-model="model" :label="label" :error="error" :disabled="disabled" placeholder="#2F54EB" maxlength="7">
    <template #end>
      <label class="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-dl-line" :style="{ background: model || 'transparent' }">
        <span class="sr-only">{{ label }}</span>
        <input
          type="color"
          :value="/^#[0-9a-f]{6}$/i.test(model) ? model : '#2f54eb'"
          :disabled="disabled"
          class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          @input="model = ($event.target as HTMLInputElement).value.toUpperCase()"
        >
      </label>
    </template>
  </DlInput>
</template>

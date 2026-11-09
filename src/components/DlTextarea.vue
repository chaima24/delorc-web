<script setup lang="ts">
import { useId } from 'vue'

/** A text box of several lines. `changed` marks a text that is not saved yet. */
withDefaults(defineProps<{
  label: string
  hideLabel?: boolean
  placeholder?: string
  hint?: string
  error?: string
  dir?: string
  rows?: number
  disabled?: boolean
  changed?: boolean
}>(), {
  hideLabel: false,
  rows: 1,
  disabled: false,
  changed: false,
})

const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <label :for="id" class="text-[13px] font-semibold text-dl-fg" :class="hideLabel && 'sr-only'">{{ label }}</label>
    <textarea
      :id="id"
      v-model="model"
      :rows="rows"
      :dir="dir"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full resize-none rounded-xl border [field-sizing:content] bg-dl-paper px-3 py-2 text-[13.5px] text-dl-fg outline-hidden transition placeholder:italic placeholder:text-dl-muted focus:ring-2 focus:ring-dl-cobalt disabled:opacity-60"
      :class="error ? 'border-dl-rejected' : changed ? 'border-dl-cobalt' : 'border-dl-line'"
    />
    <p v-if="error" class="text-xs font-semibold text-dl-rejected">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-dl-muted">{{ hint }}</p>
  </div>
</template>

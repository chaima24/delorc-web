<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'
import DlIcon from './DlIcon.vue'

// Extra attributes (autocomplete, autofocus, name…) go to the <input>; class/style stay on the wrapper.
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  label: string
  /** Keep the label for screen readers only. */
  hideLabel?: boolean
  type?: string
  placeholder?: string
  icon?: string
  hint?: string
  error?: string
  disabled?: boolean
  /** Taller field, for the sign-in pages. */
  large?: boolean
  /** Spaced bold digits, for one-time codes. */
  code?: boolean
}>(), {
  hideLabel: false,
  type: 'text',
  disabled: false,
  large: false,
  code: false,
})

const model = defineModel<string | number | null>()
const id = useId()
const attrs = useAttrs()
const inputAttrs = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest.style
  return rest
})
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5" :class="attrs.class" :style="attrs.style">
    <label
      :for="id"
      class="text-[13px] font-semibold text-dl-fg"
      :class="hideLabel && 'sr-only'"
    >{{ label }}</label>
    <div
      class="flex items-center gap-2.5 rounded-xl border bg-dl-paper px-3.5 transition focus-within:ring-2 focus-within:ring-dl-cobalt"
      :class="[large ? 'h-12' : 'h-11', error ? 'border-dl-rejected' : 'border-dl-line', disabled && 'opacity-60']"
    >
      <DlIcon v-if="icon" :icon="icon" :size="18" class="text-dl-muted" />
      <input
        :id="id"
        v-bind="inputAttrs"
        v-model="model"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error || hint ? `${id}-help` : undefined"
        class="h-full min-w-0 flex-1 border-0 bg-transparent text-dl-fg outline-hidden placeholder:text-dl-muted"
        :class="code ? 'text-lg font-semibold tracking-[0.2em]' : 'text-sm'"
      >
      <slot name="end" />
    </div>
    <p
      v-if="error || hint"
      :id="`${id}-help`"
      class="text-xs"
      :class="error ? 'text-dl-rejected' : 'text-dl-muted'"
    >
      {{ error || hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useAttrs, useId } from 'vue'
import DlIcon from './DlIcon.vue'

// Extra attributes (autocomplete, autofocus, name…) go to the <input>; class/style stay on the wrapper.
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
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
  /** A key that jumps into the field from anywhere on the page (e.g. `/`), shown at its end. */
  shortcut?: string
}>(), {
  hideLabel: false,
  type: 'text',
  disabled: false,
  large: false,
  code: false,
})

const model = defineModel<string | number | null>()
const field = ref<HTMLInputElement | null>(null)

/** The shortcut works when the person is not typing somewhere else. */
function onKey(event: KeyboardEvent): void {
  const typing = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')
  if (props.shortcut && event.key === props.shortcut && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    field.value?.focus()
  }
}
onMounted(() => { if (props.shortcut) window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
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
        ref="field"
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
      <kbd v-if="shortcut" class="hidden shrink-0 rounded-md border border-dl-line px-1.5 py-0.5 font-sans text-xs text-dl-muted sm:inline">{{ shortcut }}</kbd>
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

<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import DlIcon from './DlIcon.vue'

export interface DlComboboxOption {
  value: string | number
  label: string
  /** Second line, e.g. a role under a person's name. Also searched. */
  hint?: string
}

/**
 * A select you can type in, for long lists (communes, people, territories). Same looks as
 * DlSelect: `field` (label above) or `filter` (label inside). Shows the first 100 matches; typing narrows them.
 */
const props = withDefaults(defineProps<{
  label: string
  /** Keep the label for screen readers only. */
  hideLabel?: boolean
  options: DlComboboxOption[]
  placeholder?: string
  hint?: string
  error?: string
  disabled?: boolean
  appearance?: 'field' | 'filter'
}>(), {
  disabled: false,
  appearance: 'field',
  hideLabel: false,
})

const model = defineModel<string | number | null>()
const { t } = useI18n()
const id = useId()
const search = ref('')
/** Typed since the list opened: until then every choice shows (the box holds the chosen label). */
const typed = ref(false)

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const matches = computed(() => {
  const query = typed.value ? normalize(search.value.trim()) : ''
  const list = query
    ? props.options.filter(option => normalize(`${option.label} ${option.hint ?? ''}`).includes(query))
    : props.options
  return list.slice(0, 100)
})
const labelOf = (value: unknown) => props.options.find(option => option.value === value)?.label ?? ''
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <label :for="id" class="text-[13px] font-semibold text-dl-fg" :class="(hideLabel || appearance === 'filter') && 'sr-only'">{{ label }}</label>
    <ComboboxRoot
      v-model="model"
      :disabled="disabled"
      ignore-filter
      open-on-click
      reset-search-term-on-blur
      @update:open="open => { if (!open) { search = ''; typed = false } }"
    >
      <ComboboxAnchor
        class="flex h-11 items-center gap-2 rounded-xl border bg-dl-paper px-3.5 transition focus-within:ring-2 focus-within:ring-dl-cobalt"
        :class="[error ? 'border-dl-rejected' : 'border-dl-line', disabled && 'opacity-60']"
      >
        <span v-if="appearance === 'filter'" aria-hidden="true" class="whitespace-nowrap text-[13px] text-dl-muted">{{ label }}</span>
        <!-- Keyed on the label: when the options arrive after the value (e.g. communes of a wilaya), the box shows it -->
        <ComboboxInput
          :id="id"
          :key="labelOf(model)"
          v-model="search"
          :display-value="labelOf"
          :placeholder="placeholder ?? t('common.search.typeToSearch')"
          :aria-invalid="!!error || undefined"
          :aria-describedby="error || hint ? `${id}-help` : undefined"
          @input="typed = true"
          @focus="($event.target as HTMLInputElement).select()"
          class="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-dl-fg outline-hidden placeholder:font-normal placeholder:text-dl-muted"
          :class="appearance === 'filter' && 'w-32'"
        />
        <ComboboxTrigger class="text-dl-muted" :aria-label="label">
          <DlIcon icon="tabler-chevron-down" :size="16" />
        </ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxPortal>
        <ComboboxContent
          position="popper"
          :side-offset="6"
          class="dl-pop z-2000 max-h-[320px] w-(--reka-combobox-trigger-width) min-w-(--reka-combobox-trigger-width) overflow-hidden rounded-2xl border border-dl-line bg-dl-paper p-1.5 text-dl-fg shadow-[0_12px_32px_-12px_rgba(15,31,28,0.25)]"
        >
          <ComboboxViewport>
            <ComboboxEmpty class="px-3 py-2.5 text-sm text-dl-muted">{{ t('common.search.noMatch') }}</ComboboxEmpty>
            <ComboboxItem
              v-for="option in matches"
              :key="option.value"
              :value="option.value"
              class="flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-[10px] px-3 py-1.5 text-sm outline-hidden data-highlighted:bg-dl-line-soft data-[state=checked]:font-semibold"
            >
              <span class="flex min-w-0 flex-col">
                <span class="truncate">{{ option.label }}</span>
                <span v-if="option.hint" class="truncate text-xs font-normal text-dl-muted">{{ option.hint }}</span>
              </span>
              <ComboboxItemIndicator class="ms-auto text-dl-cobalt">
                <DlIcon icon="tabler-check" :size="16" />
              </ComboboxItemIndicator>
            </ComboboxItem>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
    <p v-if="error || hint" :id="`${id}-help`" class="text-xs" :class="error ? 'text-dl-rejected' : 'text-dl-muted'">{{ error || hint }}</p>
  </div>
</template>

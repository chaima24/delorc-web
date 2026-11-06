<script setup lang="ts">
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'
import DlIcon from './DlIcon.vue'

export interface DlSelectOption {
  value: string | number
  label: string
}

withDefaults(defineProps<{
  label: string
  /** Keep the label for screen readers only. */
  hideLabel?: boolean
  options: DlSelectOption[]
  placeholder?: string
  /**
   * `field`: label above the control (forms).
   * `filter`: compact chip with the label inside (filter bars).
   */
  appearance?: 'field' | 'filter'
  disabled?: boolean
}>(), {
  appearance: 'field',
  hideLabel: false,
  disabled: false,
})

const model = defineModel<string | number | null>()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <span v-if="appearance === 'field' && !hideLabel" class="text-[13px] font-semibold text-dl-fg">{{ label }}</span>
    <!-- Nothing to pick: disabled, so an empty list never opens (and never locks the page scroll). -->
    <SelectRoot v-model="model" :disabled="disabled || !options.length">
      <SelectTrigger
        :aria-label="label"
        class="flex h-11 items-center gap-2 rounded-xl border border-dl-line bg-dl-paper px-3.5 text-sm text-dl-fg transition hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt data-disabled:opacity-60"
      >
        <span v-if="appearance === 'filter' && !hideLabel" class="text-[13px] text-dl-muted">{{ label }}</span>
        <SelectValue :placeholder="placeholder" class="font-semibold data-placeholder:font-normal data-placeholder:text-dl-muted" />
        <SelectIcon class="ms-auto text-dl-muted">
          <DlIcon icon="tabler-chevron-down" :size="16" />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          position="popper"
          :side-offset="6"
          class="dl-pop z-2000 max-h-[320px] min-w-(--reka-select-trigger-width) overflow-hidden rounded-2xl border border-dl-line bg-dl-paper p-1.5 text-dl-fg shadow-[0_12px_32px_-12px_rgba(15,31,28,0.25)]"
        >
          <SelectViewport>
            <SelectItem
              v-for="option in options"
              :key="option.value"
              :value="option.value"
              class="flex h-10 cursor-pointer select-none items-center gap-2 rounded-[10px] px-3 text-sm outline-hidden data-highlighted:bg-dl-line-soft data-[state=checked]:font-semibold"
            >
              <SelectItemText>{{ option.label }}</SelectItemText>
              <SelectItemIndicator class="ms-auto text-dl-cobalt">
                <DlIcon icon="tabler-check" :size="16" />
              </SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>

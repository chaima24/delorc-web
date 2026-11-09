<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { useI18n } from 'vue-i18n'
import DlIcon from './DlIcon.vue'

/**
 * Side panel that replaces full-screen modals: the page behind stays visible.
 * `side="bottom"` gives a mobile bottom sheet.
 */
withDefaults(defineProps<{
  title: string
  description?: string
  side?: 'end' | 'bottom'
  size?: 'md' | 'lg'
}>(), {
  side: 'end',
  size: 'md',
})

const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
</script>

<template>
  <DialogRoot v-model:open="open">
    <slot name="trigger" />
    <DialogPortal>
      <DialogOverlay class="dl-overlay fixed inset-0 z-1900 bg-[#0F1F1C]/40" />
      <DialogContent
        class="fixed z-2000 flex flex-col bg-dl-paper text-dl-fg shadow-[0_24px_64px_-24px_rgba(15,31,28,0.45)] focus:outline-hidden"
        :class="side === 'end'
          ? ['dl-sheet inset-y-0 inset-e-0 w-full', size === 'lg' ? 'max-w-[720px]' : 'max-w-[480px]']
          : 'dl-sheet-bottom inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl'"
      >
        <header class="flex items-start gap-3 border-b border-dl-line-soft px-6 py-5">
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle class="font-display text-[22px] font-extrabold leading-tight tracking-[-0.01em]">
              {{ title }}
            </DialogTitle>
            <DialogDescription v-if="description" class="text-[13px] text-dl-muted">
              {{ description }}
            </DialogDescription>
          </div>
          <slot name="actions" />
          <DialogClose
            :aria-label="t('common.actions.close')"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-dl-line hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
          >
            <DlIcon icon="tabler-x" :size="18" />
          </DialogClose>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="flex flex-wrap justify-end gap-2 border-t border-dl-line-soft px-6 py-4">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

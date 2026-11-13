<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { activeConfirm, settleConfirm, type ConfirmIcon } from '@/composables/useConfirm'
import DlIcon from './DlIcon.vue'

/** Renders the dialogs requested through `useConfirm()`. Mount once, in App.vue. */
const { t } = useI18n()

const request = computed(() => activeConfirm.value)
const open = computed({
  get: () => !!activeConfirm.value,
  set: (value: boolean) => { if (!value) settleConfirm('cancel') },
})

const looks: Record<ConfirmIcon, { icon: string; tile: string }> = {
  warning: { icon: 'tabler-alert-triangle', tile: 'bg-dl-rejected/10 text-dl-rejected' },
  error: { icon: 'tabler-circle-x', tile: 'bg-dl-rejected/10 text-dl-rejected' },
  success: { icon: 'tabler-circle-check', tile: 'bg-dl-signal text-dl-ink' },
  info: { icon: 'tabler-info-circle', tile: 'bg-dl-cobalt/10 text-dl-cobalt' },
  question: { icon: 'tabler-help-circle', tile: 'bg-dl-ink text-dl-signal' },
}

const look = computed(() => looks[request.value?.icon ?? 'question'])
const isDestructive = computed(() => request.value?.icon === 'warning' || request.value?.icon === 'error')
const isAlert = computed(() => request.value?.cancelButtonText === null)

const buttonBase = 'inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt focus-visible:ring-offset-2 focus-visible:ring-offset-dl-paper'
const confirmClass = computed(() => [
  buttonBase,
  isDestructive.value && !isAlert.value
    ? 'bg-dl-rejected text-white hover:brightness-95'
    : 'bg-dl-ink text-dl-on-ink hover:bg-dl-ink-2 dark:bg-dl-fg dark:text-dl-mist',
])
const secondaryClass = [buttonBase, 'border border-dl-line bg-dl-paper text-dl-fg hover:bg-dl-line-soft']
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay class="dl-overlay fixed inset-0 z-2100 bg-dl-ink/40" />
      <AlertDialogContent
        v-if="request"
        class="dl-pop fixed left-1/2 top-1/2 z-2200 flex w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-3xl bg-dl-paper p-6 font-sans text-dl-fg shadow-[0_24px_64px_-24px_rgba(15,31,28,0.45)] focus:outline-hidden"
      >
        <div class="flex items-start gap-4">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" :class="look.tile">
            <DlIcon :icon="look.icon" :size="24" />
          </span>
          <div class="flex min-w-0 flex-col gap-1.5 pt-0.5">
            <AlertDialogTitle class="font-display text-xl font-extrabold leading-tight tracking-[-0.01em]">
              {{ request.title ?? t('common.confirm.title') }}
            </AlertDialogTitle>
            <AlertDialogDescription v-if="request.text" class="text-sm leading-relaxed text-dl-body">
              {{ request.text }}
            </AlertDialogDescription>
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-2">
          <!-- Plain buttons: Reka's Action/Cancel close the dialog first, which settles it as "cancel". -->
          <button v-if="!isAlert" type="button" :class="secondaryClass" @click="settleConfirm('cancel')">
            {{ request.cancelButtonText ?? t('common.actions.cancel') }}
          </button>
          <button type="button" :class="confirmClass" @click="settleConfirm('confirm')">
            {{ request.confirmButtonText ?? (isAlert ? t('common.actions.ok') : t('common.status.yes')) }}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

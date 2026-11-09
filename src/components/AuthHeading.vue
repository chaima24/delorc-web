<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { space } from '@/space'
import { useLabStore } from '@/stores/lab'

/** Top of every sign-in form: where you are, the title, one line of help. */
defineProps<{ title: string; text: string }>()

const { t } = useI18n()
const labStore = useLabStore()
</script>

<template>
  <div class="mb-4 flex flex-col gap-2">
    <span class="text-sm font-semibold text-dl-muted">{{ space.isCentral ? t('auth.space.central') : (labStore.lab?.name ?? space.labId) }}</span>
    <h1 class="font-display text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em]">{{ title }}</h1>
    <p class="text-[15px] text-dl-body">{{ text }}</p>
  </div>
</template>

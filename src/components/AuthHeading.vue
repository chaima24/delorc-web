<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { space } from '@/space'

/** Top of every sign-in form: where you are, the title, one line of help. */
defineProps<{ title: string; text: string }>()

const { t } = useI18n()
</script>

<template>
  <div class="mb-4 flex flex-col gap-2">
    <span class="text-sm font-semibold text-dl-muted">{{ space.labId ?? t('auth.space.central') }}</span>
    <h1 class="font-display text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em]">{{ title }}</h1>
    <p class="text-[15px] text-dl-body">{{ text }}</p>
  </div>
</template>

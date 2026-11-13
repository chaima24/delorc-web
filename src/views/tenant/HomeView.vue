<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useLabStore } from '@/stores/lab'

/** The page after sign-in, until the dashboard (module 10). */
const { t } = useI18n()
const auth = useAuthStore()
const labStore = useLabStore()
const firstName = computed(() => auth.user?.name.split(' ')[0] ?? '')
</script>

<template>
  <section class="rounded-3xl bg-dl-paper px-6 py-[22px]">
    <span class="text-[13px] text-dl-muted">{{ labStore.lab?.name }}</span>
    <h1 class="mt-1.5 font-display text-[32px] font-extrabold tracking-[-0.03em]">{{ t('home.hello', { name: firstName }) }}</h1>
    <p class="mt-1 text-dl-body">{{ t('home.welcome') }}</p>
  </section>
</template>

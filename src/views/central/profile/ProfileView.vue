<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/** My profile. Its Identity and Security cards come in the next step. */
const { t } = useI18n()
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.topbar.myProfile') }}</h1>
  </section>
</template>

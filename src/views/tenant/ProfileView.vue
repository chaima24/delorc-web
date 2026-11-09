<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/** The lab profile page: the title only for now. Its cards come with the lab profile routes. */
const { t } = useI18n()
</script>

<template>
  <h1 class="font-display text-[32px] font-extrabold tracking-[-0.03em]">{{ t('layout.topbar.myProfile') }}</h1>
</template>

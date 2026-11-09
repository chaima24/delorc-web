<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ProfileIdentity from './ProfileIdentity.vue'
import ProfileSecurity from './ProfileSecurity.vue'

/** My profile: open to every central user, from the menu on their initials. */
const { t } = useI18n()
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.topbar.myProfile') }}</h1>
    <div class="grid items-start gap-4 lg:grid-cols-2">
      <ProfileIdentity />
      <ProfileSecurity />
    </div>
  </section>
</template>

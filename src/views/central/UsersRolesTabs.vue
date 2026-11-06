<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

/** People and Roles, at the top of both pages. */
const { t } = useI18n()
const auth = useAuthStore()
</script>

<template>
  <nav class="flex flex-wrap gap-1.5" :aria-label="t('central.menu.usersRoles')">
    <RouterLink
      v-if="auth.can('users.show')"
      :to="{ name: 'central-users' }"
      class="flex h-[34px] items-center rounded-[11px] bg-dl-paper px-3 text-[13px] font-semibold text-dl-body no-underline"
      active-class="bg-dl-signal-soft! text-dl-fg! shadow-[inset_0_0_0_1.5px_rgb(var(--dl-ink))]"
    >{{ t('central.users.title') }}</RouterLink>
    <RouterLink
      v-if="auth.can('roles.show')"
      :to="{ name: 'central-roles' }"
      class="flex h-[34px] items-center rounded-[11px] bg-dl-paper px-3 text-[13px] font-semibold text-dl-body no-underline"
      active-class="bg-dl-signal-soft! text-dl-fg! shadow-[inset_0_0_0_1.5px_rgb(var(--dl-ink))]"
    >{{ t('central.roles.title') }}</RouterLink>
  </nav>
</template>

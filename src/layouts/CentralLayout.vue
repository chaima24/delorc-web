<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import DlIconButton from '@/components/DlIconButton.vue'
import DlLogo from '@/components/DlLogo.vue'
import DlIcon from '@/components/DlIcon.vue'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// Each module adds its line here when it is built.
const menu = computed(() =>
  [
    { to: 'central-labs', pages: ['central-labs', 'central-lab-new', 'central-lab'], label: 'central.menu.labs', icon: 'tabler-building-factory-2', allowed: auth.can('labs.show') },
    { to: 'central-users', pages: ['central-users'], label: 'central.users.title', icon: 'tabler-users', allowed: auth.can('users.show') },
    { to: 'central-roles', pages: ['central-roles', 'central-role-access'], label: 'central.roles.title', icon: 'tabler-shield-lock', allowed: auth.can('roles.show') },
    { to: 'central-activity', pages: ['central-activity'], label: 'central.menu.activity', icon: 'tabler-history', allowed: auth.can('activity-log.show') },
    {
      to: auth.can('translations.show') ? 'central-translations' : 'central-languages',
      pages: ['central-translations', 'central-languages'],
      label: 'central.menu.translations',
      icon: 'tabler-language',
      allowed: auth.can('translations.show') || auth.can('languages.show'),
    },
    { to: 'central-countries', pages: ['central-countries', 'central-country'], label: 'central.menu.geography', icon: 'tabler-map', allowed: auth.can('geography.show') },
    { to: 'central-plans', pages: ['central-plans'], label: 'central.menu.plans', icon: 'tabler-stack-2', allowed: auth.can('plans.show') },
  ].filter((item) => item.allowed),
)

async function signOut(): Promise<void> {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-screen bg-dl-mist font-sans text-dl-fg">
    <nav :aria-label="t('central.menu.label')" class="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col gap-5 bg-dl-ink px-4 py-[18px] md:flex">
      <DlLogo :size="40" wordmark on-dark />
      <ul class="flex flex-col gap-1.5">
        <li v-for="item in menu" :key="item.to">
          <RouterLink
            :to="{ name: item.to }"
            class="flex h-11 items-center gap-3 rounded-[14px] px-3 text-sm font-semibold no-underline"
            :class="item.pages.includes(String(route.name)) ? 'bg-dl-signal text-dl-ink' : 'text-dl-on-ink-muted hover:bg-dl-ink-2'"
          >
            <DlIcon :icon="item.icon" :size="20" />
            {{ t(item.label) }}
          </RouterLink>
        </li>
      </ul>
    </nav>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex items-center justify-end gap-3 border-b border-dl-line px-4 py-3 md:px-7">
        <span class="text-sm font-semibold">{{ auth.user?.name }}</span>
        <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-dl-cobalt text-sm font-bold text-white">{{ auth.user?.initials }}</span>
        <DlIconButton icon="tabler-logout" :label="t('auth.logout')" @click="signOut" />
      </header>
      <main class="flex-1 px-4 py-5 md:px-7">
        <RouterView />
      </main>
    </div>
  </div>
</template>

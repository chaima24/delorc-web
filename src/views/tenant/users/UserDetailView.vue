<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { fetchUser, type TenantUser } from '@/api/tenant/users'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTabs from '@/components/DlTabs.vue'
import UserAccessTab from './tabs/UserAccessTab.vue'
import UserAssignmentsTab from './tabs/UserAssignmentsTab.vue'
import UserCyclesTab from './tabs/UserCyclesTab.vue'
import UserOverviewTab from './tabs/UserOverviewTab.vue'
import UserRulesTab from './tabs/UserRulesTab.vue'
import { useUserActions } from './useUserActions'
import { STATUS_TONES, accountStatus, currentTeams, useUserText } from './userDisplay'

// A person's full page: Overview · Assignments · Cycles · Rules · Sign-in and access.
// Assignments has the teams, managers and territory; Cycles lists the person's cycles (docs/api/cycles.md).
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const text = useUserText()

const user = ref<TenantUser | null>(null)
const failed = ref(false)
async function load() {
  try {
    user.value = await fetchUser(props.id)
    failed.value = false
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => {
  user.value = null
  load()
}, { immediate: true })

const TABS = ['overview', 'assignments', 'cycles', 'rules', 'access'] as const
const tab = computed({
  get: () => (TABS.includes(route.query.tab as typeof TABS[number]) ? String(route.query.tab) : 'overview'),
  set: value => router.replace({ query: { ...route.query, tab: value === 'overview' ? undefined : value } }),
})
const tabs = computed(() => TABS.map(value => ({ value, label: t(`users.tabs.${value}`) })))

const actions = useUserActions(user, { onChange: load })
const status = computed(() => (user.value ? accountStatus(user.value) : 'active'))
</script>

<template>
  <div class="flex w-full flex-col gap-5 pb-10">
    <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex flex-wrap items-center gap-1.5 text-sm text-dl-muted">
      <span>{{ t('nav.workspaces.studio') }}</span>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <RouterLink :to="{ name: 'tenant-users' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('users.title') }}</RouterLink>
      <template v-if="user">
        <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
        <span>{{ user.full_name }}</span>
      </template>
    </nav>

    <p v-if="failed" class="rounded-3xl bg-dl-paper p-5 text-sm text-dl-rejected">{{ t('users.page.notFound') }}</p>
    <div v-else-if="!user" class="flex flex-col gap-3" aria-hidden="true">
      <DlSkeleton class="h-28 rounded-3xl" />
      <DlSkeleton class="h-64 rounded-3xl" />
    </div>

    <template v-else>
      <header class="flex flex-wrap items-center gap-4 rounded-3xl bg-dl-paper p-5 md:gap-5 md:p-6">
        <DlAvatar :name="user.full_name" :src="user.avatar?.url" size="xl" :tone="status === 'inactive' ? 'neutral' : 'cobalt'" />
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <h1 class="font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ user.full_name }}</h1>
          <div class="flex flex-wrap items-center gap-1.5">
            <DlBadge size="sm">{{ text.role(user) }}</DlBadge>
            <DlBadge v-for="team in currentTeams(user)" :key="team.id" size="sm">{{ team.name }}</DlBadge>
            <DlBadge size="sm" dot :tone="STATUS_TONES[status]">{{ text.status(user) }}</DlBadge>
          </div>
        </div>
        <!-- Every action in sight (access link, deactivate) -->
        <div class="flex flex-wrap gap-2 max-sm:w-full">
          <DlButton
            v-for="item in actions.menuItems.value"
            :key="item.label"
            :variant="item.danger ? 'danger' : 'outline'"
            :icon="item.icon"
            :loading="actions.busy.value"
            class="max-sm:flex-1"
            @click="item.onSelect"
          >
            {{ item.label }}
          </DlButton>
        </div>
      </header>

      <DlTabs v-model="tab" :label="user.full_name" :items="tabs">
        <template #overview><UserOverviewTab :user="user" @changed="load" @go="value => (tab = value)" /></template>
        <template #assignments><UserAssignmentsTab :user="user" @changed="load" /></template>
        <template #rules><UserRulesTab :user="user" @changed="load" /></template>
        <template #cycles><UserCyclesTab :user="user" /></template>
        <template #access><UserAccessTab :user="user" :actions="actions" @changed="load" /></template>
      </DlTabs>
    </template>
  </div>
</template>

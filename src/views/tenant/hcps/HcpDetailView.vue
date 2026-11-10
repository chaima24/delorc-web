<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { deleteHcp, fetchHcp, type Hcp } from '@/api/tenant/hcps'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTabs from '@/components/DlTabs.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import HcpBadges from './HcpBadges.vue'
import { avatarName, useHcpText } from './hcpForm'
import { useHcpFigures } from './useHcpFigures'
import HcpOverviewTab from './tabs/HcpOverviewTab.vue'

// A professional's full page: header with the 4 figures, then tabs Overview · Visits · Cycles · Consents
// (each list tab only with its own permission; Visits, Cycles and Consents show "Arrive avec…" until their modules).
// Proposals (5d) add their banner. Mockup: docs/design/customers-mockups/Professionals.html (frames 6–6c)
const props = defineProps<{ id: string }>()
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const text = useHcpText()

const hcp = ref<Hcp | null>(null)
const failed = ref(false)
async function load() {
  try {
    hcp.value = await fetchHcp(Number(props.id))
    failed.value = false
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => {
  hcp.value = null
  load()
}, { immediate: true })

const figures = useHcpFigures(hcp)

const TABS = [
  { value: 'overview', resource: null },
  { value: 'visits', resource: 'visits', count: 'visits' },
  { value: 'cycles', resource: 'cycles', count: 'cycle_targets' },
  { value: 'consents', resource: 'consents', count: 'consents' },
] as const
/** Tabs whose module comes later. */
const LATER = ['visits', 'cycles', 'consents'] as const
const visibleTabs = computed(() => TABS.filter(tab => !tab.resource || auth.can(`${tab.resource}.show`)))
const tab = computed({
  get: () => (visibleTabs.value.some(item => item.value === route.query.tab) ? String(route.query.tab) : 'overview'),
  set: value => router.replace({ query: { ...route.query, tab: value === 'overview' ? undefined : value } }),
})
const tabs = computed(() => visibleTabs.value.map(item => {
  const count = 'count' in item ? hcp.value?.activity?.counts?.[item.count] : undefined
  return { value: item.value, label: count ? `${t(`hcps.tabs.${item.value}`)} · ${n(count)}` : t(`hcps.tabs.${item.value}`) }
}))

const addedLine = computed(() => {
  if (!hcp.value) return ''
  const by = hcp.value.added_by?.full_name ?? null
  return by ? t('hcps.page.addedBy', { date: text.date(hcp.value.created_at), name: by }) : t('hcps.page.added', { date: text.date(hcp.value.created_at) })
})

async function remove() {
  if (!hcp.value) return
  const ok = await confirm({
    title: t('studio.list.delete.title', { name: hcp.value.name }),
    text: t('hcps.delete.text'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteHcp(hcp.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-hcps' })
  }
  catch (error) {
    // The API says why (visits, orders… add their refusal with their modules).
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5 pb-10">
    <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex flex-wrap items-center gap-1.5 text-sm text-dl-muted">
      <span>{{ t('nav.workspaces.customers') }}</span>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <RouterLink :to="{ name: 'tenant-hcps' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('hcps.title') }}</RouterLink>
      <template v-if="hcp">
        <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
        <span>{{ hcp.name }}</span>
      </template>
    </nav>

    <p v-if="failed" class="rounded-3xl bg-dl-paper p-5 text-sm text-dl-rejected">{{ t('hcps.page.notFound') }}</p>
    <div v-else-if="!hcp" class="flex flex-col gap-3" aria-hidden="true">
      <DlSkeleton class="h-28 rounded-3xl" />
      <DlSkeleton class="h-64 rounded-3xl" />
    </div>

    <template v-else>

      <header class="flex flex-col gap-5 rounded-3xl bg-dl-paper p-5 md:p-6">
        <div class="flex flex-wrap items-center gap-4 md:gap-5">
          <DlAvatar :name="avatarName(hcp.name)" size="xl" tone="signal" />
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <h1 class="font-display text-[24px] font-extrabold leading-tight tracking-[-0.03em] md:text-[30px]">{{ hcp.name }}</h1>
            <div class="flex flex-wrap items-center gap-1.5">
              <HcpBadges :hcp="hcp" />
              <span class="text-xs text-dl-muted">· {{ text.code(hcp) }} · {{ addedLine }}</span>
            </div>
          </div>
          <DlButton v-if="auth.can('hcps.delete')" variant="danger" icon="tabler-trash" class="max-sm:w-full" @click="remove">{{ t('common.actions.delete') }}</DlButton>
        </div>

        <dl v-if="figures.length" class="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <div v-for="figure in figures" :key="figure.key" class="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-dl-mist px-4 py-3">
            <dt class="text-xs text-dl-muted">{{ figure.label }}</dt>
            <dd class="truncate font-display text-[20px] font-extrabold tabular-nums md:text-[22px]" :class="figure.tone">{{ figure.value }}</dd>
            <dd class="truncate text-[11.5px] text-dl-muted">{{ figure.note }}</dd>
          </div>
        </dl>
      </header>

      <DlTabs v-model="tab" :label="hcp.name" :items="tabs">
        <template #overview><HcpOverviewTab :hcp="hcp" @changed="load" /></template>
        <template v-for="later in LATER" :key="later" #[later]>
          <div class="rounded-3xl bg-dl-paper p-5">
            <DlEmptyState icon="tabler-clock" :title="t(`hcps.later.${later}.title`)" :description="t(`hcps.later.${later}.text`)" />
          </div>
        </template>
      </DlTabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { HCP_MISSING, fetchHcpMissingCounts, type HcpMissingCounts } from '@/api/tenant/hcps'
import { fetchTerritory, type Territory } from '@/api/tenant/territories'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTabs from '@/components/DlTabs.vue'
import { useAuthStore } from '@/stores/auth'
import HcpMap from '@/views/tenant/hcps/HcpMap.vue'
import TerritoryCoversSection from './TerritoryCoversSection.vue'
import TerritoryDetailsSection from './TerritoryDetailsSection.vue'
import TerritoryPeople from './TerritoryPeople.vue'
import TerritoryHcpsTab from './tabs/TerritoryHcpsTab.vue'
import { personName } from './territoryText'
import { useTerritoryDelete } from './useTerritoryDelete'

// A territory's full page: 4 figures, tabs Overview · Professionals · People · Sub-territories.
// Overview: what it covers + map, who works it, where it sits, missing data, details.
// Mockup: docs/design/customers-mockups/Territories.html (frames 7–8)
const props = defineProps<{ id: string }>()
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canShow = (resource: string) => auth.can(`${resource}.show`)
const canDelete = (resource: string) => auth.can(`${resource}.delete`)
const { remove } = useTerritoryDelete()

const territory = ref<Territory | null>(null)
const failed = ref(false)
const missing = ref<HcpMissingCounts | null>(null)
async function load() {
  try {
    territory.value = await fetchTerritory(Number(props.id))
    failed.value = false
  }
  catch {
    failed.value = true
    return
  }
  if (canShow('hcps')) {
    fetchHcpMissingCounts({ 'filter[in_territory]': Number(props.id) })
      .then(counts => (missing.value = counts))
      .catch(() => (missing.value = null))
  }
}
watch(() => props.id, () => {
  territory.value = null
  missing.value = null
  load()
}, { immediate: true })

const figures = computed(() => {
  const activity = territory.value?.activity
  if (!activity) return []
  const byType = Object.entries(activity.by_type).map(([type, count]) => t(`territories.typeCount.${type}`, { n: n(count ?? 0) }, count ?? 0)).join(' · ')
  // Visits and coverage come with the visits module ("Arrive avec les visites" until then).
  const visits = activity.visits_year
  const visited = activity.visited_year
  const coverage = activity.hcps && visited !== null ? Math.round((visited / activity.hcps) * 100) : 0
  return [
    { key: 'hcps', label: t('territories.figures.hcps'), value: n(activity.hcps), note: byType || '—' },
    { key: 'visits', label: t('territories.page.visitsYear', { year: new Date().getFullYear() }), value: visits === null ? '—' : n(visits), note: visits === null ? t('territories.page.withVisits') : t('territories.page.visitsNote') },
    { key: 'coverage', label: t('territories.page.coverageYear', { year: new Date().getFullYear() }), value: visited === null ? '—' : `${n(coverage)} %`, note: visited === null ? t('territories.page.withVisits') : t('territories.page.coverageNote', { done: n(visited), total: n(activity.hcps) }) },
    { key: 'under', label: t('territories.figures.under'), value: n(activity.children), note: territory.value?.parent ? t('territories.position.in', { name: territory.value.parent.name }) : t('territories.position.top') },
  ]
})

const TABS = ['overview', 'hcps', 'people', 'under'] as const
const tab = computed({
  get: () => ((TABS as readonly string[]).includes(String(route.query.tab)) && (route.query.tab !== 'hcps' || canShow('hcps')) ? String(route.query.tab) : 'overview'),
  set: value => router.replace({ query: { ...route.query, tab: value === 'overview' ? undefined : value } }),
})
const tabs = computed(() => TABS.filter(item => item !== 'hcps' || canShow('hcps')).map(item => {
  const count = { overview: undefined, hcps: territory.value?.activity?.hcps, people: territory.value?.activity?.people_total, under: territory.value?.activity?.children }[item]
  return { value: item, label: count ? `${t(`territories.tabs.${item}`)} · ${n(count)}` : t(`territories.tabs.${item}`) }
}))

const now = computed(() => territory.value?.people ?? [])
const mapQuery = computed(() => ({ 'filter[in_territory]': Number(props.id) }))
const missingRows = computed(() => HCP_MISSING.filter(key => key !== 'verified' && (missing.value?.[key] ?? 0) > 0))

function openTerritory(id: number) {
  router.push({ name: 'tenant-territory-detail', params: { id } })
}
async function onDelete() {
  if (territory.value && await remove(territory.value)) router.push({ name: 'tenant-territories' })
}
</script>

<template>
  <div class="flex w-full flex-col gap-5 pb-10">
    <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex flex-wrap items-center gap-1.5 text-sm text-dl-muted">
      <span>{{ t('nav.workspaces.plan') }}</span>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <RouterLink :to="{ name: 'tenant-territories' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('territories.title') }}</RouterLink>
      <template v-if="territory">
        <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
        <span>{{ territory.name }}</span>
      </template>
    </nav>

    <p v-if="failed" class="rounded-3xl bg-dl-paper p-5 text-sm text-dl-rejected">{{ t('territories.page.notFound') }}</p>
    <div v-else-if="!territory" class="flex flex-col gap-3" aria-hidden="true">
      <DlSkeleton class="h-28 rounded-3xl" />
      <DlSkeleton class="h-64 rounded-3xl" />
    </div>

    <template v-else>
      <header class="flex flex-col gap-5 rounded-3xl bg-dl-paper p-5 md:p-6">
        <div class="flex flex-wrap items-center gap-4 md:gap-5">
          <span class="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-dl-signal text-dl-ink"><DlIcon icon="tabler-map-pins" :size="30" /></span>
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <h1 class="font-display text-[24px] font-extrabold leading-tight tracking-[-0.03em] md:text-[30px]">{{ territory.name }}</h1>
            <p class="flex flex-wrap items-center gap-x-1.5 text-xs text-dl-muted">
              <span>{{ territory.parent ? t('territories.position.in', { name: territory.parent.name }) : t('territories.position.top') }}</span>
              <span v-if="territory.sector">· {{ t('territories.fields.sector') }}: {{ territory.sector }}</span>
              <span>· {{ now.length ? now.map(row => personName(row.user)).join(', ') : t('territories.people.nobodyShort') }}</span>
            </p>
          </div>
          <DlButton v-if="canDelete('territories')" variant="danger" icon="tabler-trash" class="max-sm:w-full" @click="onDelete">{{ t('common.actions.delete') }}</DlButton>
        </div>
        <dl class="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <div v-for="figure in figures" :key="figure.key" class="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-dl-mist px-4 py-3">
            <dt class="text-xs text-dl-muted">{{ figure.label }}</dt>
            <dd class="truncate font-display text-[20px] font-extrabold tabular-nums md:text-[22px]">{{ figure.value }}</dd>
            <dd class="truncate text-[11.5px] text-dl-muted">{{ figure.note }}</dd>
          </div>
        </dl>
      </header>

      <DlTabs v-model="tab" :label="territory.name" :items="tabs">
        <template #overview>
          <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div class="flex min-w-0 flex-col gap-4">
              <TerritoryCoversSection :territory="territory" class="rounded-3xl! border-0 bg-dl-paper p-1" @changed="load" />
              <HcpMap v-if="canShow('hcps') && territory.activity?.hcps" :query="mapQuery" @open="id => router.push({ name: 'tenant-hcp-detail', params: { id } })" />
            </div>
            <div class="flex min-w-0 flex-col gap-4">
              <TerritoryPeople :territory-id="territory.id" :covers="territory.covers" :limit="2" class="rounded-3xl border-0 bg-dl-paper p-1" @changed="load" />
              <section class="rounded-3xl bg-dl-paper p-4 text-[13px]">
                <h3 class="mb-2 text-sm font-semibold">{{ t('territories.page.where') }}</h3>
                <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-2">
                  <dt class="text-dl-muted">{{ t('territories.fields.parent') }}</dt>
                  <dd><button v-if="territory.parent" type="button" class="text-dl-cobalt hover:underline" @click="openTerritory(territory.parent.id)">{{ territory.parent.name }} ›</button><span v-else>{{ t('territories.position.top') }}</span></dd>
                  <dt class="text-dl-muted">{{ t('territories.page.nextTo') }}</dt>
                  <dd class="flex flex-wrap gap-x-2"><button v-for="item in territory.siblings" :key="item.id" type="button" class="text-dl-cobalt hover:underline" @click="openTerritory(item.id)">{{ item.name }}</button><span v-if="!territory.siblings?.length">—</span></dd>
                  <dt class="text-dl-muted">{{ t('territories.page.under') }}</dt>
                  <dd class="flex flex-wrap gap-x-2"><button v-for="item in territory.children" :key="item.id" type="button" class="text-dl-cobalt hover:underline" @click="openTerritory(item.id)">{{ item.name }}</button><span v-if="!territory.children?.length">{{ t('territories.page.nothingUnder') }}</span></dd>
                </dl>
              </section>
              <section v-if="missingRows.length" class="rounded-3xl bg-dl-paper p-4 text-[13px]">
                <h3 class="mb-2 text-sm font-semibold">{{ t('territories.page.missing') }}</h3>
                <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-2">
                  <template v-for="key in missingRows" :key="key">
                    <dt class="text-dl-muted">{{ t(`hcps.missing.${key}`) }}</dt>
                    <dd><RouterLink :to="{ name: 'tenant-hcps', query: { territory: territory.id, missing: key } }" class="text-dl-cobalt">{{ t('territories.hcpsShort', { n: n(missing?.[key] ?? 0) }, missing?.[key] ?? 0) }} ›</RouterLink></dd>
                  </template>
                </dl>
              </section>
              <TerritoryDetailsSection :territory="territory" class="rounded-3xl! border-0 bg-dl-paper p-1" @changed="load" @open="openTerritory" />
            </div>
          </div>
        </template>
        <template #hcps><TerritoryHcpsTab :territory-id="territory.id" /></template>
        <template #people><TerritoryPeople :territory-id="territory.id" :covers="territory.covers" class="rounded-3xl border-0 bg-dl-paper p-1" @changed="load" /></template>
        <template #under>
          <div class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4">
            <p v-if="!territory.children?.length" class="text-sm text-dl-muted">{{ t('territories.page.nothingUnder') }}</p>
            <button v-for="item in territory.children" :key="item.id" type="button" class="flex items-center justify-between rounded-2xl border border-dl-line px-3.5 py-2.5 text-start text-[13.5px] font-semibold hover:border-dl-body" @click="openTerritory(item.id)">
              {{ item.name }}<DlIcon icon="tabler-chevron-right" :size="16" class="text-dl-muted rtl:-scale-x-100" />
            </button>
          </div>
        </template>
      </DlTabs>
    </template>
  </div>
</template>

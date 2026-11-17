<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { deleteAction, fetchAction, fetchCountedActivities, type CountedActivity, type MarketingAction } from '@/api/tenant/marketingActions'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useCampaignText } from '@/views/tenant/campaigns/campaignDisplay'
import ActionMarketingSheet from './ActionMarketingSheet.vue'
import ActionProgress from './ActionProgress.vue'

// A marketing action's page (docs/api/marketing-actions.md, mockup frame 3): six figures and one line per person the
// viewer sees; a line opens beside the list the activities that counted for that person.
const props = defineProps<{ id: string; actionId: string }>()
const { t, n, d } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useCampaignText()
const canEdit = computed(() => auth.can('campaigns.update'))

const action = ref<MarketingAction | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    action.value = await fetchAction(Number(props.actionId))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.actionId, () => { action.value = null; load() }, { immediate: true })

const money = (value: number | null | undefined) => (value == null ? '—' : `${n(value, { maximumFractionDigits: 0 })} DA`)
const state = computed(() => {
  const a = action.value
  if (!a) return null
  const today = new Date().toISOString().slice(0, 10)
  return a.start_date > today ? 'upcoming' : a.end_date < today ? 'ended' : 'current'
})
const tiles = computed(() => {
  const f = action.value?.figures
  return f ? [
    { value: n(f.people), label: t('actions.tiles.people') },
    { value: n(f.planned), label: t('actions.tiles.planned') },
    { value: n(f.done), label: t('actions.tiles.done') },
    { value: `${f.rate} %`, label: t('actions.tiles.rate') },
    { value: money(f.budget), label: t('actions.tiles.budget') },
    { value: money(f.per_done), label: t('actions.tiles.perDone') },
  ] : []
})
const columns = computed(() => [
  { key: 'person', label: t('actions.columns.person') },
  { key: 'team', label: t('actions.columns.team'), secondary: true },
  { key: 'objective', label: t('actions.columns.objective'), align: 'end' as const },
  { key: 'done', label: t('actions.columns.progress') },
  { key: 'last_at', label: t('actions.columns.last'), secondary: true },
])
type PersonRow = NonNullable<MarketingAction['people']>[number]
const day = (value: string) => d(new Date(value.replace(' ', 'T')), { day: 'numeric', month: 'short' })

// The panel beside the list: the activities that counted for one person.
const picked = ref<PersonRow | null>(null)
const activities = ref<CountedActivity[] | null>(null)
const panelOpen = computed({ get: () => picked.value !== null, set: value => { if (!value) picked.value = null } })
async function show(row: PersonRow) {
  picked.value = row
  activities.value = null
  activities.value = await fetchCountedActivities(Number(props.actionId), row.user.id).catch(() => [])
}
const span = (a: CountedActivity) => (a.start_at.slice(0, 10) === a.end_at.slice(0, 10)
  ? `${day(a.start_at)} · ${a.start_at.slice(11, 16)} → ${a.end_at.slice(11, 16)}`
  : `${day(a.start_at)} → ${day(a.end_at)}`)

const editing = ref(false)
function saved(row: MarketingAction) {
  editing.value = false
  action.value = row
}
async function remove() {
  if (!action.value) return
  const ok = await confirm({ title: t('actions.page.deleteTitle', { name: action.value.activity_type.name }), text: t('actions.page.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteAction(action.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-campaign', params: { id: props.id }, query: { tab: 'actions' } })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('actions.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-campaign', params: { id }, query: { tab: 'actions' } }">{{ t('actions.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!action">
      <DlSkeleton class="h-28 rounded-3xl" />
      <div class="grid gap-3 lg:grid-cols-6"><DlSkeleton v-for="i in 6" :key="i" class="h-20 rounded-3xl" /></div>
    </template>

    <template v-else>
      <div class="flex flex-col gap-1.5">
        <nav class="flex flex-wrap items-center gap-1.5 text-[13px] text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
          <RouterLink :to="{ name: 'tenant-campaigns' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('campaigns.list.title') }}</RouterLink> ›
          <RouterLink :to="{ name: 'tenant-campaign', params: { id }, query: { tab: 'actions' } }" class="text-dl-muted no-underline hover:text-dl-fg">{{ action.campaign?.name }}</RouterLink> ›
          <span>{{ t('campaigns.tabs.actions') }}</span>
        </nav>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ action.activity_type.name }}</h1>
          <DlBadge v-if="state" size="sm" :tone="state === 'current' ? 'success' : state === 'upcoming' ? 'info' : 'neutral'" dot>{{ t(`campaigns.state.${state}`) }}</DlBadge>
          <div v-if="canEdit" class="ms-auto flex gap-2">
            <DlButton variant="outline" size="sm" icon="tabler-pencil" @click="editing = true">{{ t('common.actions.edit') }}</DlButton>
            <DlButton variant="outline" size="sm" icon="tabler-trash" @click="remove">{{ t('common.actions.delete') }}</DlButton>
          </div>
        </div>
        <p class="text-[13px] text-dl-muted">
          {{ [text.period(action.start_date, action.end_date), [action.wilaya?.name, action.address].filter(Boolean).join(', '), action.specialities.map(s => s.name).join(', '), t('actions.page.each', { count: n(action.objective) }, action.objective)].filter(Boolean).join(' · ') }}
          <template v-if="action.created_by"> · {{ t('actions.page.addedBy', { name: action.created_by.full_name, date: text.date(action.created_at) }) }}</template>
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div v-for="tile in tiles" :key="tile.label" class="flex flex-col gap-1 rounded-3xl bg-dl-paper p-4">
          <strong class="font-display text-[22px] leading-none">{{ tile.value }}</strong>
          <span class="text-xs text-dl-muted">{{ tile.label }}</span>
        </div>
      </div>

      <div class="flex items-start gap-5">
        <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
          <DlDataList :label="t('actions.columns.person')" :columns="columns" :rows="action.people ?? []" :row-key="row => row.user.id" :empty-title="t('actions.page.nobody')" @open="show">
            <template #cell-person="{ row }"><strong class="font-semibold">{{ row.user.full_name }}</strong></template>
            <template #cell-team="{ row }">{{ row.team ?? '—' }}</template>
            <template #cell-objective="{ row }"><span class="tabular-nums">{{ n(row.objective) }}</span></template>
            <template #cell-done="{ row }"><ActionProgress :done="row.done" :planned="row.objective" /></template>
            <template #cell-last_at="{ row }"><span class="text-dl-muted">{{ row.last_at ? day(row.last_at) : '—' }}</span></template>
            <template #card="{ row }">
              <strong class="block font-semibold">{{ row.user.full_name }}</strong>
              <span class="text-xs text-dl-muted">{{ n(row.done) }} / {{ n(row.objective) }}</span>
            </template>
          </DlDataList>
          <p class="text-xs text-dl-muted">{{ t('actions.page.note') }}</p>
        </div>

        <DlRecordPanel v-if="picked" v-model:open="panelOpen" :title="picked.user.full_name" :description="t('actions.page.personCount', { done: n(picked.done), objective: n(picked.objective) })">
          <DlSkeleton v-if="!activities" class="h-32 rounded-2xl" />
          <p v-else-if="!activities.length" class="text-[13px] text-dl-muted">{{ t('actions.page.noActivity') }}</p>
          <div v-for="activity in activities ?? []" :key="activity.id" class="mb-2 flex flex-col gap-0.5 rounded-2xl bg-dl-mist px-3 py-2.5">
            <strong class="text-sm">{{ activity.title }}</strong>
            <span class="text-xs text-dl-muted">{{ span(activity) }}</span>
          </div>
          <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('actions.page.panelNote', { type: action.activity_type.name }) }}</p>
        </DlRecordPanel>
      </div>

      <ActionMarketingSheet v-if="editing && action.campaign" v-model:open="editing" :campaign="action.campaign" :action="action" @saved="saved" />
    </template>
  </div>
</template>

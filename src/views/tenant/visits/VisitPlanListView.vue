<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { fetchVisitPlans, type VisitPlanRow } from '@/api/tenant/visitPlanning'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { refreshOnFocus } from '@/composables/refreshOnFocus'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { todayIso, useVisitText } from './visitDisplay'
import { dateOf, isoOf } from './visitPlanning'

// Visites › Plans à approuver: the cycles' plans sent by the people below the viewer, and the changes that came
// after an approval. A row opens the person's Planning, where the plan is approved. Mockup: visits-mockups/Approval.html (frame 3)
const { t, n, d } = useI18n()
const text = useVisitText()
const month = ref(todayIso().slice(0, 7))
const state = ref<'to_approve' | 'all'>('to_approve')
const search = ref('')
const rows = ref<VisitPlanRow[]>([])
const toApprove = ref(0)
const loading = ref(true)
/** The lab did not turn the approval on: the API answers 404. */
const off = ref(false)

async function load() {
  try {
    const result = await fetchVisitPlans({ month: month.value, 'filter[state]': state.value, 'filter[q]': search.value.trim() || undefined })
    rows.value = result.items
    toApprove.value = result.to_approve
    off.value = false
  }
  catch (error) {
    off.value = axios.isAxiosError(error) && error.response?.status === 404
    rows.value = []
  }
  finally {
    loading.value = false
  }
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(load, 300)
})
watch([month, state], load, { immediate: true })
refreshOnFocus(load)

const monthLabel = computed(() => d(dateOf(`${month.value}-01`), { month: 'long', year: 'numeric' }))
function step(direction: 1 | -1) {
  const date = dateOf(`${month.value}-01`)
  date.setMonth(date.getMonth() + direction)
  month.value = isoOf(date).slice(0, 7)
}
const states = computed(() => [{ value: 'to_approve', label: t('visits.approval.board.toApprove') }, { value: 'all', label: t('visits.approval.board.all') }])
const TONE = { draft: 'neutral', sent: 'warning', approved: 'success', refused: 'danger' } as const
/** What the row says: the plan sent, the changes after an approval, or the plan's state. */
const line = (row: VisitPlanRow) => (row.changes ? t('visits.approval.board.changes', { n: n(row.counts.waiting) }, row.counts.waiting) : t(`visits.approval.plan.${row.plan.status}`))
const detail = (row: VisitPlanRow) => (row.counts.waiting
  ? t('visits.approval.board.waiting', { n: n(row.counts.waiting) }, row.counts.waiting)
  : row.plan.status === 'draft' ? t('visits.approval.board.drafts', { n: n(row.counts.draft) }, row.counts.draft)
    : row.plan.decided_by ? t('visits.approval.board.decidedBy', { name: row.plan.decided_by.full_name, date: text.date(row.plan.decided_at) }) : '')
/** The person's Planning, on a day of the cycle that is in the month shown. */
const planOf = (row: VisitPlanRow) => ({ name: 'tenant-visit-planning', query: { user: row.user.id, date: row.cycle.start_date > `${month.value}-01` ? row.cycle.start_date : `${month.value}-01` } })
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.visits') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('visits.approval.board.title') }}</h1>
        <p class="text-[13px] text-dl-muted">{{ t('visits.approval.board.subtitle', { n: n(toApprove) }, toApprove) }}</p>
      </div>
      <div class="flex items-center gap-2">
        <DlIconButton icon="tabler-chevron-left" variant="outline" :size="38" :label="t('visits.planning.previous')" @click="step(-1)" />
        <strong class="min-w-36 text-center text-sm first-letter:uppercase">{{ monthLabel }}</strong>
        <DlIconButton icon="tabler-chevron-right" variant="outline" :size="38" :label="t('visits.planning.next')" @click="step(1)" />
      </div>
    </div>

    <DlEmptyState v-if="off" icon="tabler-checklist" :title="t('visits.approval.board.off')" :description="t('visits.approval.board.offText')" />
    <template v-else>
      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-64 max-md:w-full"><DlInput v-model="search" type="search" icon="tabler-search" :label="t('visits.approval.board.search')" :placeholder="t('visits.approval.board.search')" hide-label /></div>
        <DlSegmented v-model="state" :label="t('visits.columns.state')" :items="states" />
      </div>

      <div class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
        <div v-if="loading" class="flex flex-col gap-2"><DlSkeleton v-for="i in 4" :key="i" class="h-14 rounded-xl" /></div>
        <DlEmptyState v-else-if="!rows.length" icon="tabler-circle-check" :title="t(state === 'to_approve' ? 'visits.approval.board.none' : 'visits.approval.board.noneAll')" />
        <ul v-else class="flex flex-col">
          <li v-for="row in rows" :key="row.cycle.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-dl-line-soft py-3 last:border-0" :class="row.plan.status === 'draft' && !row.counts.waiting && 'opacity-60'">
            <span class="min-w-48 flex-1">
              <strong class="block font-semibold">{{ row.user.full_name }}</strong>
              <small class="text-xs text-dl-muted">{{ [roleLabel(row.user.role), row.user.team].filter(Boolean).join(' · ') }}</small>
            </span>
            <span class="w-52 text-[13px] text-dl-muted">{{ t('visits.cyclePeriod', { from: text.date(row.cycle.start_date), to: text.date(row.cycle.end_date) }) }}</span>
            <span class="w-56">
              <DlBadge size="sm" :tone="row.changes ? 'warning' : TONE[row.plan.status]" dot>{{ line(row) }}</DlBadge>
              <small class="mt-0.5 block text-xs text-dl-muted">{{ detail(row) }}</small>
            </span>
            <span class="w-28 text-[13px] text-dl-muted">{{ row.plan.sent_at ? text.date(row.plan.sent_at) : '—' }}</span>
            <DlButton :variant="row.counts.waiting ? 'dark' : 'outline'" size="sm" :to="planOf(row)">{{ t('visits.approval.board.open') }}</DlButton>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

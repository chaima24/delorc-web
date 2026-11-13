<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { fetchExpenseBoard, type ExpenseBoard, type ExpenseBoardRow } from '@/api/tenant/expenses'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlSelect from '@/components/DlSelect.vue'
import { exportToXlsx } from '@/composables/exportXlsx'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useTeamOptions } from '@/views/tenant/settings/shared/lookups'
import { today } from '@/views/tenant/users/userDisplay'
import ExpenseMonthView from './ExpenseMonthView.vue'
import { shiftMonth, STATUS_BAR, useExpenseText } from './expenseDisplay'

// Équipe › Frais. Managers: one row per person for the month (days, km paid, nights, total, days by status),
// waiting first. People who approve nobody see their own month instead. Mockup: docs/design/team-mockups/Expenses.html (frame 1)
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const text = useExpenseText()
const auth = useAuthStore()
const canStore = (resource: string) => auth.can(`${resource}.create`)
const { teams } = useTeamOptions()

const manager = computed(() => auth.can('expenses.approve'))
const ALL = 'all'
const month = ref(typeof route.query.month === 'string' && /^\d{4}-\d{2}$/.test(route.query.month) ? route.query.month : today().slice(0, 7))
const team = ref<string | number>(ALL)
watch(month, () => router.replace({ query: { ...route.query, month: month.value } }))

const board = ref<ExpenseBoard | null>(null)
const loading = ref(true)
let request = 0
async function load() {
  if (!manager.value) return
  const mine = ++request
  loading.value = true
  try {
    const body = await fetchExpenseBoard({ month: month.value, team_id: team.value === ALL ? undefined : Number(team.value) })
    if (mine === request) board.value = body
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    if (mine === request) loading.value = false
  }
}
watch([month, team, manager], load, { immediate: true })

const teamOptions = computed(() => [{ value: ALL, label: t('users.filter.allTeams') }, ...teams.value])

// Person and order: on the rows already loaded.
const person = ref<string | number>(ALL)
const order = ref<'waiting' | 'total' | 'name'>('waiting')
const personOptions = computed(() => [
  { value: ALL, label: t('expenses.filter.allPeople') },
  ...(board.value?.rows ?? []).map(row => ({ value: row.user.id, label: row.user.full_name })).sort((a, b) => a.label.localeCompare(b.label)),
])
const orderOptions = computed(() => (['waiting', 'total', 'name'] as const).map(value => ({ value, label: t(`expenses.filter.order.${value}`) })))
const rows = computed(() => {
  const list = (board.value?.rows ?? []).filter(row => person.value === ALL || row.user.id === Number(person.value))
  if (order.value === 'name') return [...list].sort((a, b) => a.user.full_name.localeCompare(b.user.full_name))
  if (order.value === 'total') return [...list].sort((a, b) => b.total - a.total)
  return list
})
const columns = computed(() => [
  { key: 'person', label: t('expenses.columns.person') },
  { key: 'days', label: t('expenses.columns.days'), align: 'end' as const },
  { key: 'km', label: t('expenses.columns.kmPaid'), align: 'end' as const, secondary: true },
  { key: 'nights', label: t('expenses.columns.nights'), align: 'end' as const, secondary: true },
  { key: 'total', label: t('expenses.columns.total'), align: 'end' as const },
  { key: 'statuses', label: t('expenses.columns.byStatus') },
  { key: 'action', label: '', align: 'end' as const },
])

function openRow(row: ExpenseBoardRow) {
  router.push({ name: 'tenant-expense-month', params: { userId: row.user.id }, query: { month: month.value } })
}
const statusParts = (row: ExpenseBoardRow) => {
  const all = row.counts.approved + row.counts.pending + row.counts.rejected
  return (['approved', 'pending', 'rejected'] as const).filter(key => row.counts[key]).map(key => ({ key, width: `${(row.counts[key] / all) * 100}%` }))
}

function exportBoard() {
  if (!board.value) return
  exportToXlsx(board.value.rows.map(row => ({
    [t('expenses.columns.person')]: row.user.full_name,
    [t('expenses.columns.days')]: row.days,
    [t('expenses.columns.kmPaid')]: row.km_paid,
    [t('expenses.columns.nights')]: row.nights,
    [t('expenses.columns.total')]: row.total,
    [t('expenses.status.approved')]: row.approved_amount,
    [t('expenses.status.pending')]: row.waiting_amount,
    [t('expenses.export.daysApproved')]: row.counts.approved,
    [t('expenses.export.daysWaiting')]: row.counts.pending,
    [t('expenses.export.daysRefused')]: row.counts.rejected,
  })), `${t('expenses.title')} ${month.value}`, t('expenses.title'))
}
</script>

<template>
  <ExpenseMonthView v-if="!manager" />
  <div v-else class="flex w-full flex-col gap-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.team') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('expenses.title') }}</h1>
        <p class="text-sm text-dl-muted">{{ t('expenses.subtitle') }}</p>
      </div>
      <div class="flex gap-2.5">
        <DlButton variant="outline" icon="tabler-download" class="max-md:hidden" :disabled="!board?.rows.length" @click="exportBoard">{{ t('expenses.export.button') }}</DlButton>
        <DlButton v-if="canStore('expenses')" variant="primary" icon="tabler-plus" :to="{ name: 'tenant-expense-new', query: { date: today().startsWith(month) ? today() : `${month}-01` } }">{{ t('expenses.form.addTitle') }}</DlButton>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <span class="flex items-center gap-1 rounded-2xl bg-dl-paper p-1">
        <DlIconButton icon="tabler-chevron-left" variant="ghost" :size="34" :label="t('activities.month.previous')" class="rtl:-scale-x-100" @click="month = shiftMonth(month, -1)" />
        <strong class="min-w-36 px-2 text-center text-[13px] first-letter:uppercase" aria-live="polite">{{ text.month(month) }}</strong>
        <DlIconButton icon="tabler-chevron-right" variant="ghost" :size="34" :label="t('activities.month.next')" class="rtl:-scale-x-100" @click="month = shiftMonth(month, 1)" />
      </span>
      <DlSelect v-model="person" :label="t('expenses.filter.person')" :options="personOptions" appearance="filter" />
      <DlSelect v-model="team" :label="t('expenses.filter.team')" :options="teamOptions" appearance="filter" />
      <DlSelect v-model="order" :label="t('expenses.filter.show')" :options="orderOptions" appearance="filter" />
    </div>

    <dl v-if="board" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5">
        <dt class="text-[12.5px] text-dl-muted">{{ t('expenses.figures.waiting') }}</dt>
        <dd class="font-display text-2xl font-extrabold tracking-[-0.02em] md:text-[30px]" :class="board.totals.waiting_amount ? 'text-dl-pending' : ''">{{ text.money(board.totals.waiting_amount) }}</dd>
        <small class="text-xs text-dl-muted">{{ `${t('expenses.figures.days', { n: n(board.totals.waiting_days) }, board.totals.waiting_days)} · ${t('expenses.figures.people', { n: n(board.totals.waiting_people) }, board.totals.waiting_people)}` }}</small>
      </div>
      <div class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5">
        <dt class="text-[12.5px] text-dl-muted">{{ t('expenses.status.approved') }}</dt>
        <dd class="font-display text-2xl font-extrabold tracking-[-0.02em] md:text-[30px]">{{ text.money(board.totals.approved_amount) }}</dd>
        <small class="text-xs text-dl-muted">{{ t('expenses.figures.days', { n: n(board.totals.approved_days) }, board.totals.approved_days) }}</small>
      </div>
      <div class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5">
        <dt class="text-[12.5px] text-dl-muted">{{ t('expenses.columns.kmPaid') }}</dt>
        <dd class="font-display text-2xl font-extrabold tracking-[-0.02em] md:text-[30px]">{{ text.km(board.totals.km_paid) }}</dd>
        <small class="text-xs text-dl-muted">{{ t('expenses.figures.kmDetail') }}</small>
      </div>
      <div class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5">
        <dt class="text-[12.5px] text-dl-muted">{{ t('expenses.figures.nothingSent') }}</dt>
        <dd class="font-display text-2xl font-extrabold tracking-[-0.02em] md:text-[30px]">{{ n(board.totals.nothing_sent) }}</dd>
        <small class="text-xs text-dl-muted">{{ t('expenses.figures.nothingSentDetail') }}</small>
      </div>
    </dl>

    <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
      <DlDataList
        :label="t('expenses.title')"
        :columns="columns"
        :rows="rows"
        :row-key="row => row.user.id"
        :loading="loading"
        :empty-title="t('expenses.empty.boardTitle', { month: text.month(month) })"
        :empty-text="t('expenses.empty.boardText')"
        @open="openRow"
      >
        <template #cell-person="{ row }">
          <span class="flex items-center gap-2.5" :class="!row.days && !row.counts.rejected && 'opacity-60'">
            <DlAvatar :name="row.user.full_name" size="sm" />
            <span class="min-w-0">
              <strong class="block truncate font-semibold">{{ row.user.full_name }}</strong>
              <small class="block truncate text-xs text-dl-muted">{{ text.roles(row.user.roles) }}</small>
            </span>
          </span>
        </template>
        <template #cell-days="{ row }"><span class="tabular-nums">{{ row.days ? n(row.days) : '—' }}</span></template>
        <template #cell-km="{ row }"><span class="tabular-nums">{{ row.days ? text.km(row.km_paid) : '—' }}</span></template>
        <template #cell-nights="{ row }">
          <span class="tabular-nums">{{ row.days ? n(row.nights) : '—' }}</span>
          <small v-if="row.nights_over" class="block text-[11.5px] text-dl-pending">{{ t('expenses.figures.nightsOver', { n: n(row.nights_over) }, row.nights_over) }}</small>
        </template>
        <template #cell-total="{ row }"><strong class="whitespace-nowrap tabular-nums">{{ row.days ? text.money(row.total) : '—' }}</strong></template>
        <template #cell-statuses="{ row }">
          <span v-if="row.days || row.counts.rejected" class="flex min-w-[130px] flex-col gap-1.5 text-xs text-dl-muted">
            <span class="flex h-2 overflow-hidden rounded-full bg-dl-line-soft"><i v-for="part in statusParts(row)" :key="part.key" :class="STATUS_BAR[part.key]" :style="{ width: part.width }" /></span>
            <span>
              <template v-for="(part, i) in statusParts(row)" :key="part.key">
                <template v-if="i"> · </template><b v-if="part.key === 'pending'" class="text-dl-pending">{{ t('expenses.board.waiting', { n: n(row.counts.pending) }) }}</b><template v-else>{{ t(`expenses.board.${part.key}`, { n: n(row.counts[part.key]) }) }}</template>
              </template>
            </span>
          </span>
          <span v-else class="text-xs text-dl-muted">{{ t('expenses.board.nothing') }}</span>
        </template>
        <template #cell-action="{ row }">
          <DlButton v-if="row.counts.pending" variant="dark" size="sm" @click.stop="openRow(row)">{{ t('expenses.board.review', { n: n(row.counts.pending) }) }}</DlButton>
          <DlButton v-else-if="row.days || row.counts.rejected" variant="outline" size="sm" @click.stop="openRow(row)">{{ t('expenses.board.open') }}</DlButton>
        </template>
        <template #card="{ row }">
          <span class="flex items-center gap-2.5">
            <DlAvatar :name="row.user.full_name" size="sm" />
            <span class="min-w-0 flex-1">
              <strong class="block truncate font-semibold">{{ row.user.full_name }}</strong>
              <small class="block truncate text-xs" :class="row.counts.pending ? 'text-dl-pending' : 'text-dl-muted'">
                {{ row.counts.pending ? t('expenses.board.waiting', { n: n(row.counts.pending) }) : row.days ? t('expenses.figures.days', { n: n(row.days) }, row.days) : t('expenses.board.nothing') }}
              </small>
            </span>
            <strong class="whitespace-nowrap tabular-nums">{{ row.days ? text.money(row.total) : '—' }}</strong>
          </span>
        </template>
      </DlDataList>
      <p class="text-xs text-dl-muted">{{ t('expenses.board.who') }}</p>
    </div>
  </div>
</template>

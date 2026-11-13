<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { approveExpenseMonth, fetchExpenseMonth, type ExpenseDay, type ExpenseMonth } from '@/api/tenant/expenses'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { exportToXlsx } from '@/composables/exportXlsx'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { today } from '@/views/tenant/users/userDisplay'
import ExpenseDayPanel from './ExpenseDayPanel.vue'
import { shiftMonth, STATUS_TONE, useExpenseText } from './expenseDisplay'

// One person's month: a line per day (trips, km paid, stay, other costs, amount, status), the month's figures,
// "Approve the waiting days". Also "My expenses" for a rep. Mockup: docs/design/team-mockups/Expenses.html (frames 2, 5)
const props = defineProps<{ userId?: number | string }>()
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const text = useExpenseText()
const auth = useAuthStore()
const canStore = (resource: string) => auth.can(`${resource}.create`)

const me = computed(() => Number(auth.user?.id))
const personId = computed(() => (props.userId ? Number(props.userId) : me.value))
const mine = computed(() => personId.value === me.value)
const month = ref(typeof route.query.month === 'string' && /^\d{4}-\d{2}$/.test(route.query.month) ? route.query.month : today().slice(0, 7))
watch(month, () => router.replace({ query: { ...route.query, month: month.value } }))

const data = ref<ExpenseMonth | null>(null)
const loading = ref(true)
let request = 0
async function load() {
  const current = ++request
  loading.value = true
  try {
    const body = await fetchExpenseMonth({ month: month.value, user_id: personId.value })
    if (current === request) data.value = body
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    if (current === request) loading.value = false
  }
}
watch([month, personId], load, { immediate: true })

const figures = computed(() => data.value?.figures)
const ALL = 'all'
const status = ref<string>(ALL)
const statusOptions = computed(() => [{ value: ALL, label: t('expenses.filter.allStatuses') }, ...(['pending', 'approved', 'rejected'] as const).map(value => ({ value, label: text.status(value) }))])
const days = computed(() => (data.value?.days ?? []).filter(day => status.value === ALL || day.status === status.value))
const refused = computed(() => (data.value?.days ?? []).filter(day => day.status === 'rejected'))
/** "VM · Cardio team · manager Nadia Hamidi" */
const who = computed(() => {
  if (!data.value) return ''
  const user = data.value.user
  return [text.roles(user.roles), user.teams.join(', '), user.managers.length ? t('expenses.month.manager', { name: user.managers.join(', ') }) : '']
    .filter(Boolean).join(' · ')
})
const waiting = computed(() => figures.value?.counts.pending ?? 0)

const columns = computed(() => [
  { key: 'date', label: t('expenses.columns.day') },
  { key: 'route', label: t('expenses.columns.trips') },
  { key: 'km', label: t('expenses.columns.km'), align: 'end' as const },
  { key: 'stay', label: t('expenses.columns.stay'), secondary: true },
  { key: 'other', label: t('expenses.columns.other'), align: 'end' as const, secondary: true },
  { key: 'total', label: t('expenses.columns.amount'), align: 'end' as const },
  { key: 'status', label: t('expenses.columns.status') },
])

// Side panel: one day. Adding or editing a day is its own page.
const open = ref(false)
const selectedId = ref<number | null>(null)
function show(row: { id: number }) {
  selectedId.value = row.id
  open.value = true
}
// Back from the add / edit page: the saved day opens.
watch(() => route.query.day, value => {
  if (typeof value === 'string' && /^\d+$/.test(value)) show({ id: Number(value) })
}, { immediate: true })
function add() {
  const date = today().startsWith(month.value) ? today() : `${month.value}-01`
  router.push({ name: 'tenant-expense-new', query: { date, ...(mine.value ? {} : { user: String(personId.value) }) } })
}
function edit(day: ExpenseDay) {
  router.push({ name: 'tenant-expense-edit', params: { id: day.id } })
}
function onDeleted() {
  open.value = false
  load()
}

const approving = ref(false)
async function approveAll() {
  if (!data.value || !figures.value) return
  const ok = await confirm({
    title: t('expenses.approve.allTitle', waiting.value),
    text: t('expenses.approve.allText', { n: n(waiting.value), amount: text.money(figures.value.waiting_amount), name: data.value.user.full_name }, waiting.value),
    confirmButtonText: t('expenses.approve.allConfirm'),
  })
  if (!ok) return
  approving.value = true
  try {
    await approveExpenseMonth(personId.value, month.value)
    toast.success(t('expenses.toast.approvedAll'))
    load()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    approving.value = false
  }
}

function exportMonth() {
  if (!data.value) return
  exportToXlsx(data.value.days.map(day => ({
    [t('expenses.columns.day')]: day.date,
    [t('expenses.columns.trips')]: text.route(day.route),
    [t('expenses.export.kmTyped')]: day.km_typed,
    [t('expenses.export.kmPaid')]: day.km_paid,
    [t('expenses.columns.stay')]: t(`expenses.stay.${day.type}`),
    [t('expenses.form.meals')]: day.meals,
    [t('expenses.columns.other')]: day.other,
    [t('expenses.columns.amount')]: day.total,
    [t('expenses.columns.status')]: text.status(day.status),
    [t('expenses.export.reason')]: day.reason ?? '',
  })), `${t('expenses.title')} ${data.value.user.full_name} ${month.value}`, t('expenses.title'))
}
</script>

<template>
  <div class="flex w-full flex-col gap-5" :class="mine && canStore('expenses') && 'max-md:pb-20'">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-sm text-dl-muted">
          {{ t('nav.workspaces.team') }}<template v-if="!mine"> › <RouterLink :to="{ name: 'tenant-expenses', query: { month } }" class="text-dl-muted no-underline hover:underline">{{ t('expenses.title') }}</RouterLink></template>
        </span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ mine ? t('expenses.mine') : (data?.user.full_name ?? '…') }}</h1>
        <p v-if="data" class="text-sm text-dl-muted">
          {{ who }}<template v-if="data.setting"> · {{ t('expenses.month.setting', { name: text.setting(data.setting), date: data.setting.start_date ? text.dayLong(data.setting.start_date) : '—' }) }}</template>
          <template v-else> · <span class="text-dl-pending">{{ t('expenses.month.noSetting') }}</span></template>
        </p>
      </div>
      <div class="flex flex-wrap gap-2.5">
        <DlButton variant="outline" icon="tabler-download" class="max-md:hidden" :disabled="!data?.days.length" @click="exportMonth">{{ t('expenses.export.button') }}</DlButton>
        <DlButton v-if="data?.can_approve && waiting" variant="primary" icon="tabler-check" :loading="approving" @click="approveAll">
          {{ t('expenses.approve.all', { n: n(waiting), amount: text.money(figures!.waiting_amount) }, waiting) }}
        </DlButton>
        <DlButton v-else-if="canStore('expenses')" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('expenses.form.addTitle') }}</DlButton>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
    <span class="flex w-max items-center gap-1 rounded-2xl bg-dl-paper p-1">
      <DlIconButton icon="tabler-chevron-left" variant="ghost" :size="34" :label="t('activities.month.previous')" class="rtl:-scale-x-100" @click="month = shiftMonth(month, -1)" />
      <strong class="min-w-36 px-2 text-center text-[13px] first-letter:uppercase" aria-live="polite">{{ text.month(month) }}</strong>
      <DlIconButton icon="tabler-chevron-right" variant="ghost" :size="34" :label="t('activities.month.next')" class="rtl:-scale-x-100" @click="month = shiftMonth(month, 1)" />
    </span>
    <DlSelect v-model="status" :label="t('expenses.columns.status')" :options="statusOptions" appearance="filter" />
    </div>

    <button
      v-for="day in refused"
      :key="day.id"
      type="button"
      class="rounded-xl bg-dl-rejected/7 px-3.5 py-2.5 text-start text-[13px] text-dl-rejected focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
      @click="show(day)"
    >
      <span class="first-letter:uppercase">{{ t('expenses.month.refusedBanner', { day: text.day(day.date), name: day.refused_by ?? '—', reason: day.reason ?? '' }) }}</span>
      <b v-if="mine"> {{ t('expenses.month.fixIt') }}</b>
    </button>

    <dl v-if="figures" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5">
        <dt class="text-[12.5px] text-dl-muted">{{ t('expenses.figures.claimed') }}</dt>
        <dd class="font-display text-2xl font-extrabold tracking-[-0.02em] md:text-[30px]">{{ text.money(figures.total) }}</dd>
        <small class="text-xs text-dl-muted">{{ t('expenses.figures.days', { n: n(figures.days) }, figures.days) }}</small>
      </div>
      <div class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5">
        <dt class="text-[12.5px] text-dl-muted">{{ t('expenses.status.approved') }}</dt>
        <dd class="font-display text-2xl font-extrabold tracking-[-0.02em] md:text-[30px]">{{ text.money(figures.approved_amount) }}</dd>
        <small class="text-xs text-dl-muted">{{ t('expenses.figures.days', { n: n(figures.counts.approved) }, figures.counts.approved) }}</small>
      </div>
      <div class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5">
        <dt class="text-[12.5px] text-dl-muted">{{ t('expenses.status.pending') }}</dt>
        <dd class="font-display text-2xl font-extrabold tracking-[-0.02em] md:text-[30px]" :class="figures.waiting_amount ? 'text-dl-pending' : ''">{{ text.money(figures.waiting_amount) }}</dd>
        <small class="text-xs text-dl-muted">{{ t('expenses.figures.days', { n: n(waiting) }, waiting) }}</small>
      </div>
      <div class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5">
        <dt class="text-[12.5px] text-dl-muted">{{ t('expenses.figures.nights') }}</dt>
        <dd class="font-display text-2xl font-extrabold tracking-[-0.02em] md:text-[30px]">
          {{ n(figures.nights) }}<span v-if="data?.setting?.max_night" class="text-lg text-dl-muted"> / {{ n(data.setting.max_night) }}</span>
        </dd>
        <small class="text-xs" :class="figures.nights_over ? 'text-dl-pending' : 'text-dl-muted'">{{ figures.nights_over ? t('expenses.figures.nightsOver', { n: n(figures.nights_over) }, figures.nights_over) : t('expenses.figures.nightsLimit') }}</small>
      </div>
    </dl>

    <div class="flex items-start gap-5">
      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          :label="t('expenses.title')"
          :columns="columns"
          :rows="days"
          :row-key="row => row.id"
          :selected-key="open ? selectedId : null"
          :loading="loading"
          :compact="open"
          :empty-title="t('expenses.empty.title', { month: text.month(month) })"
          :empty-text="mine ? t('expenses.empty.mine') : t('expenses.empty.text')"
          @open="show"
        >
          <template #cell-date="{ row }"><strong class="whitespace-nowrap font-semibold first-letter:uppercase">{{ text.day(row.date) }}</strong></template>
          <template #cell-route="{ row }">{{ text.route(row.route) }}</template>
          <template #cell-km="{ row }">
            <span class="tabular-nums">{{ text.km(row.km_paid) }}</span>
            <small v-if="row.km_typed > row.km_paid" class="block whitespace-nowrap text-[11.5px] text-dl-pending">{{ t('expenses.month.typed', { km: text.km(row.km_typed) }) }}</small>
          </template>
          <template #cell-stay="{ row }">
            <span class="whitespace-nowrap">{{ row.type === 'away' ? '🌙' : '🏠' }} {{ t(`expenses.stay.${row.type}`) }}</span>
            <small class="block text-[11.5px] text-dl-muted">
              {{ t('expenses.panel.meals', { n: row.meals }, row.meals) }}<b v-if="row.meals_over" class="text-dl-pending"> · {{ t('expenses.month.overLimit') }}</b><b v-if="row.type === 'away' && !row.night_paid" class="text-dl-pending"> · {{ t('expenses.month.noNight') }}</b>
            </small>
          </template>
          <template #cell-other="{ row }"><span class="whitespace-nowrap tabular-nums">{{ row.other ? text.money(row.other) : '—' }}</span></template>
          <template #cell-total="{ row }">
            <strong class="whitespace-nowrap tabular-nums" :class="row.status === 'rejected' && 'text-dl-muted line-through'">{{ text.money(row.total) }}</strong>
          </template>
          <template #cell-status="{ row }"><DlBadge size="sm" :tone="STATUS_TONE[row.status]">{{ text.status(row.status) }}</DlBadge></template>
          <template #card="{ row }">
            <span class="flex items-center justify-between gap-2">
              <span class="min-w-0">
                <strong class="block font-semibold first-letter:uppercase">{{ text.day(row.date) }}</strong>
                <small class="block truncate text-xs text-dl-muted">{{ text.route(row.route) }} · {{ t('expenses.km', { km: text.km(row.km_paid) }) }}</small>
              </span>
              <span class="flex flex-col items-end gap-1">
                <strong class="whitespace-nowrap tabular-nums" :class="row.status === 'rejected' && 'text-dl-muted line-through'">{{ text.money(row.total) }}</strong>
                <DlBadge size="sm" :tone="STATUS_TONE[row.status]">{{ text.status(row.status) }}</DlBadge>
              </span>
            </span>
          </template>
        </DlDataList>
        <p class="text-xs text-dl-muted">
          {{ t('expenses.month.workingDaysOnly') }}<template v-for="activity in data?.activities ?? []" :key="activity.id"> · {{ text.span(activity.from, activity.to) }}: {{ activity.title }}</template>
        </p>
      </div>

      <ExpenseDayPanel v-if="open && selectedId" v-model:open="open" :day-id="selectedId" @changed="load" @deleted="onDeleted" @edit="edit" />
    </div>

    <div v-if="canStore('expenses') && !(data?.can_approve && waiting)" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="add">{{ t('expenses.form.addTitle') }}</DlButton>
    </div>
  </div>
</template>

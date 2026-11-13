<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  createExpenseDays,
  fetchExpenseDay,
  fetchExpenseZones,
  previewExpenseDay,
  previewExpenseDays,
  updateExpenseDay,
  type ExpenseAmounts,
  type ExpenseDay,
  type ExpenseDayInput,
  type ExpenseType,
  type ExpenseZone,
} from '@/api/tenant/expenses'
import { fetchExpenseTypes, type ExpenseType as ExpenseKind } from '@/api/tenant/fieldSetup'
import { fetchCommunes, fetchWilayas, type Commune, type ListParams, type Page, type Wilaya } from '@/api/tenant/geography'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useUsers } from '@/views/tenant/territories/useTerritoryLookups'
import { today } from '@/views/tenant/users/userDisplay'
import ExpenseAmountLines from './ExpenseAmountLines.vue'
import { useExpenseText } from './expenseDisplay'

// "Add expenses": one block per day (date, trips from a commune to a commune, the night and meals of the day,
// other costs); each block becomes one day claim. Editing opens one day. Mockup: docs/design/team-mockups/Expenses.html (frame 5)
const props = defineProps<{ id?: number | string }>()
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const text = useExpenseText()
const auth = useAuthStore()
const users = useUsers()

/** Every row of a list, 100 at a time. */
async function allOf<T>(fetch: (params: ListParams) => Promise<Page<T>>, params: ListParams = {}): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; ; page++) {
    const result = await fetch({ ...params, page, per_page: 100 })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) break
  }
  return rows
}
// Expense types and wilayas, loaded when the page opens and again on coming back to the tab.
const types = { items: ref<ExpenseKind[]>([]) }
const wilayas = { items: ref<Wilaya[]>([]) }
onMountedAndFocus(() => {
  allOf(fetchExpenseTypes).then(rows => { types.items.value = rows }).catch(() => toast.error(t('studio.list.toast.failed')))
  allOf(fetchWilayas, { sort: 'name' }).then(rows => { wilayas.items.value = rows }).catch(() => toast.error(t('studio.list.toast.failed')))
})

const me = computed(() => Number(auth.user?.id))
const editing = ref<ExpenseDay | null>(null)
const loading = ref(!!props.id)
const isEdit = computed(() => !!props.id)
const queryUser = typeof route.query.user === 'string' ? Number(route.query.user) : null
const userId = computed(() => editing.value?.user_id ?? queryUser ?? me.value)
const mine = computed(() => userId.value === me.value)
const personName = computed(() => editing.value?.user.full_name ?? users.items.value.find(user => user.id === userId.value)?.full_name ?? '')
if (!mine.value) users.ensureLoaded()

// Communes of a wilaya, loaded when the wilaya is picked (once per visit).
const communesOf = ref<Record<number, Commune[]>>({})
const pending: Record<number, Promise<void>> = {}
function loadCommunes(wilayaId: number | null) {
  if (!wilayaId || communesOf.value[wilayaId]) return
  pending[wilayaId] ??= allOf(fetchCommunes, { sort: 'name', 'filter[wilaya_id]': wilayaId })
    .then(rows => { communesOf.value = { ...communesOf.value, [wilayaId]: rows } })
    .catch(() => { delete pending[wilayaId] })
}
const byName = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)
const wilayaOptions = computed(() => wilayas.items.value.map(w => ({ value: w.id, label: w.name })).sort(byName))
const communeOptions = (wilayaId: number | null) => (wilayaId ? (communesOf.value[wilayaId] ?? []).map(c => ({ value: c.id, label: c.name })).sort(byName) : [])

interface Place { wilaya: number | null; commune: number | null }
interface TripRow { key: number; from: Place; to: Place; km: string; zone: ExpenseZone; zoneHint: string; zoneTouched: boolean; type: number | null }
interface CostRow { key: number; id: number | null; type: number | null; price: string; description: string; receipt: File | null; receiptName: string }
interface DayBlock { key: number; date: string; type: ExpenseType; meals: number; comment: string; trips: TripRow[]; costs: CostRow[] }
let keys = 0
const days = reactive<DayBlock[]>([])
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const amounts = ref<(ExpenseAmounts | null)[]>([])
const grandTotal = ref<number | null>(null)

const tripTypes = computed(() => types.items.value.filter(row => row.type !== 'other'))
const costTypes = computed(() => {
  const other = types.items.value.filter(row => row.type === 'other')
  return other.length ? other : types.items.value
})
const option = (row: { id: number; content: string }) => ({ value: row.id, label: row.content })
// Types arrive after the first rows are drawn: give those rows the first type.
watch([tripTypes, costTypes], () => days.forEach(day => {
  day.trips.forEach(trip => { trip.type ??= tripTypes.value[0]?.id ?? null })
  day.costs.forEach(cost => { cost.type ??= costTypes.value[0]?.id ?? null })
}))

function newTrip(from: Place = { wilaya: null, commune: null }): TripRow {
  return { key: ++keys, from: { ...from }, to: { wilaya: from.wilaya, commune: null }, km: '', zone: 'in', zoneHint: '', zoneTouched: false, type: tripTypes.value[0]?.id ?? null }
}
function newCost(): CostRow {
  return { key: ++keys, id: null, type: costTypes.value[0]?.id ?? null, price: '', description: '', receipt: null, receiptName: '' }
}
function newDay(date: string, from?: Place): DayBlock {
  return { key: ++keys, date, type: 'home', meals: 1, comment: '', trips: [newTrip(from)], costs: [] }
}
/** A new trip starts where the last one arrived. */
function addTrip(day: DayBlock) {
  const last = day.trips[day.trips.length - 1]
  day.trips.push(newTrip(last ? last.to : undefined))
}
/** The next day starts the day after the last one, from where it ended. */
function addDay() {
  const last = days[days.length - 1]!
  const next = new Date(`${last.date}T12:00:00`)
  next.setDate(next.getDate() + 1)
  days.push(newDay(next.toISOString().slice(0, 10), last.trips[last.trips.length - 1]?.to))
}

async function load() {
  if (!props.id) {
    days.push(newDay(typeof route.query.date === 'string' ? route.query.date : today()))
    return
  }
  try {
    const found = await fetchExpenseDay(Number(props.id))
    editing.value = found
    days.push({
      key: ++keys,
      date: found.date,
      type: found.type,
      meals: found.meals,
      comment: found.comment ?? '',
      trips: found.trips.map(trip => ({
        key: ++keys,
        from: { wilaya: trip.departure_commune?.wilaya_id ?? null, commune: trip.departure_commune?.id ?? null },
        to: { wilaya: trip.arrival_commune?.wilaya_id ?? null, commune: trip.arrival_commune?.id ?? null },
        km: String(trip.km), zone: trip.zone, zoneHint: '', zoneTouched: true, type: trip.expense_type?.id ?? null,
      })),
      costs: found.costs.map(cost => ({ key: ++keys, id: cost.id, type: cost.expense_type?.id ?? null, price: String(cost.price), description: cost.description ?? '', receipt: null, receiptName: cost.receipt ? t('expenses.form.receiptKept') : '' })),
    })
    days[0]!.trips.forEach(trip => { loadCommunes(trip.from.wilaya); loadCommunes(trip.to.wilaya) })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
load()

function setWilaya(place: Place, value: string | number | null | undefined) {
  const id = value == null ? null : Number(value)
  if (id === place.wilaya) return
  place.wilaya = id
  place.commune = null
  loadCommunes(id)
}
// Zone of a trip: suggested from the person's territory when the arrival is picked (they can change it).
async function setArrival(day: DayBlock, trip: TripRow, value: string | number | null | undefined) {
  trip.to.commune = value == null ? null : Number(value)
  if (!trip.to.commune || trip.zoneTouched) return
  try {
    const zones = await fetchExpenseZones({ user_id: userId.value, date: day.date, commune_ids: [trip.to.commune] })
    const found = zones[trip.to.commune]
    if (!found || trip.zoneTouched) return
    trip.zone = found.zone
    const place = wilayas.items.value.find(w => w.id === trip.to.wilaya)?.name ?? ''
    trip.zoneHint = found.zone_type
      ? t('expenses.form.zoneFrom', { place, zone: t(`ruleTypes.zoneTypes.${found.zone_type}`), result: t(`expenses.zone.${found.zone}`).toLowerCase() })
      : t('expenses.form.zoneUnknown')
  }
  catch { /* the person picks it */ }
}
function setZone(trip: TripRow, zone: string) {
  trip.zone = zone as ExpenseZone
  trip.zoneTouched = true
  trip.zoneHint = ''
}
function pickReceipt(cost: CostRow, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  cost.receipt = file
  cost.receiptName = file?.name ?? ''
}

const zoneItems = computed(() => [
  { value: 'in', label: t('expenses.zone.in') },
  { value: 'out', label: t('expenses.zone.out') },
])
const STAYS = [
  { value: 'home' as const, icon: '🍽' },
  { value: 'away' as const, icon: '🌙' },
]

function inputOf(day: DayBlock): ExpenseDayInput {
  return {
    date: day.date,
    type: day.type,
    meals: day.meals,
    comment: day.comment.trim() || null,
    trips: day.trips.filter(trip => trip.from.commune && trip.to.commune && trip.type).map(trip => ({
      departure_commune_id: trip.from.commune!, arrival_commune_id: trip.to.commune!, expense_type_id: trip.type!, km: Number(trip.km) || 0, zone: trip.zone,
    })),
    costs: day.costs.filter(cost => cost.type && cost.price !== '').map(cost => ({
      id: cost.id, expense_type_id: cost.type!, price: Number(cost.price) || 0, description: cost.description.trim() || null, receipt: cost.receipt,
    })),
  }
}

// Live totals, a moment after the last change.
let timer: ReturnType<typeof setTimeout> | undefined
let previewRequest = 0
watch(() => [loading.value, days.map(day => [day.date, day.type, day.meals, day.trips.map(r => [r.from.commune, r.to.commune, r.km, r.zone, r.type]), day.costs.map(r => [r.type, r.price])])], () => {
  if (loading.value || !days.length || days.some(day => !day.date)) return
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const current = ++previewRequest
    try {
      if (isEdit.value) {
        const one = await previewExpenseDay({ ...inputOf(days[0]!), user_id: userId.value }, editing.value?.id)
        if (current !== previewRequest) return
        amounts.value = [one]
        grandTotal.value = one.total
      }
      else {
        const result = await previewExpenseDays(userId.value, days.map(inputOf))
        if (current !== previewRequest) return
        amounts.value = result.days
        grandTotal.value = result.total
      }
    }
    catch { /* shown again once the days are valid */ }
  }, 400)
}, { deep: true, immediate: true })

const backTo = computed(() => {
  const month = (days[0]?.date ?? today()).slice(0, 7)
  return mine.value
    ? { name: 'tenant-expense-mine', query: { month } }
    : { name: 'tenant-expense-month', params: { userId: userId.value }, query: { month } }
})
/** Back to the person's month, with the (first) saved day open. */
function back(savedId?: number) {
  const target = backTo.value
  router.push({ ...target, query: { ...target.query, ...(savedId ? { day: String(savedId) } : {}) } })
}

async function save() {
  errors.value = {}
  const found: Record<string, string> = {}
  days.forEach((day, d) => {
    if (!day.date) found[`days.${d}.date`] = t('users.add.required')
    day.trips.forEach((trip, i) => {
      const started = trip.from.commune || trip.to.commune || trip.km
      if (started && (!trip.from.commune || !trip.to.commune || !trip.km || !trip.type)) found[`days.${d}.trips.${i}`] = t('expenses.form.tripIncomplete')
    })
  })
  if (Object.keys(found).length) {
    errors.value = found
    return
  }
  saving.value = true
  try {
    if (isEdit.value) {
      const saved = await updateExpenseDay(editing.value!.id, { ...inputOf(days[0]!), user_id: userId.value })
      toast.success(t('studio.list.toast.saved'))
      back(saved.id)
    }
    else {
      const saved = await createExpenseDays(userId.value, days.map(inputOf))
      toast.success(t('expenses.toast.sentDays', { n: n(saved.length) }, saved.length))
      back(saved[0]?.id)
    }
  }
  catch (error) {
    const found = fieldErrors(error)
    if (!Object.keys(found).length) {
      toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
      return
    }
    // Edit sends one day (keys "date", "trips.0…"); add sends days (keys "days.0.date"…). The API's messages are translated.
    errors.value = Object.fromEntries(Object.entries(found).map(([key, message]) => {
      const full = key.startsWith('days.') ? key : `days.0.${key}`
      return [full.split('.').slice(0, full.includes('.trips.') || full.includes('.costs.') ? 4 : 3).join('.'), message]
    }))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-sm text-dl-muted">
        {{ t('nav.workspaces.team') }} ›
        <RouterLink :to="backTo" class="text-dl-muted no-underline hover:underline">{{ mine ? t('expenses.mine') : personName || t('expenses.title') }}</RouterLink>
      </span>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">
        {{ isEdit && editing ? t('expenses.form.editPage', { day: text.dayLong(editing.date) }) : t('expenses.form.addPageTitle') }}
      </h1>
      <p class="text-sm text-dl-muted">
        <template v-if="!mine && personName">{{ t('expenses.form.forPerson', { name: personName }) }} · </template>{{ isEdit ? t('expenses.form.editHint') : t('expenses.form.addPageHint') }}
      </p>
    </div>

    <div v-if="loading" class="flex flex-col gap-4"><DlSkeleton v-for="i in 3" :key="i" class="h-40 rounded-3xl" /></div>
    <form v-else id="expense-form" class="flex flex-col gap-4" @submit.prevent="save">
      <section v-for="(day, d) in days" :key="day.key" class="flex flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-5">
        <header class="flex items-center gap-3">
          <h2 class="flex-1 text-base font-semibold">{{ isEdit ? t('expenses.form.day') : t('expenses.form.dayN', { n: d + 1 }) }}</h2>
          <strong v-if="amounts[d]" class="whitespace-nowrap text-sm tabular-nums">{{ text.money(amounts[d]!.total) }}</strong>
          <DlIconButton v-if="days.length > 1" icon="tabler-trash" variant="ghost" :size="34" :label="t('expenses.form.removeDay')" @click="days.splice(d, 1)" />
        </header>
        <DlInput v-model="day.date" type="date" :label="t('expenses.form.date')" :hint="t('expenses.form.dayHint')" :error="errors[`days.${d}.date`]" class="sm:max-w-xs" />

        <div class="flex flex-col gap-2.5">
          <h3 class="text-sm font-semibold">{{ t('expenses.panel.trips') }}</h3>
          <div v-for="(trip, i) in day.trips" :key="trip.key" class="flex flex-col gap-3 rounded-2xl border p-4" :class="errors[`days.${d}.trips.${i}`] ? 'border-dl-rejected' : 'border-dl-line'">
            <div class="flex items-center justify-between">
              <span class="text-[13px] font-semibold text-dl-muted">{{ t('expenses.form.trip', { n: i + 1 }) }}</span>
              <DlIconButton icon="tabler-trash" variant="ghost" :size="34" :label="t('expenses.form.removeTrip')" @click="day.trips.splice(i, 1)" />
            </div>
            <div class="grid gap-4 lg:grid-cols-2">
              <div v-for="end in (['from', 'to'] as const)" :key="end" class="flex flex-col gap-2">
                <strong class="text-[13px]">{{ t(`expenses.form.${end}`) }}</strong>
                <div class="grid gap-2.5 sm:grid-cols-2">
                  <DlCombobox :model-value="trip[end].wilaya" :label="t('expenses.form.wilaya')" :options="wilayaOptions" @update:model-value="value => setWilaya(trip[end], value)" />
                  <DlCombobox
                    :model-value="trip[end].commune"
                    :label="t('expenses.form.commune')"
                    :options="communeOptions(trip[end].wilaya)"
                    :disabled="!trip[end].wilaya"
                    :hint="trip[end].wilaya ? undefined : t('expenses.form.wilayaFirst')"
                    @update:model-value="value => end === 'to' ? setArrival(day, trip, value) : (trip.from.commune = value == null ? null : Number(value))"
                  />
                </div>
              </div>
            </div>
            <div class="grid items-start gap-2.5 sm:grid-cols-[140px_1fr] lg:grid-cols-[140px_1fr_1fr]">
              <DlInput v-model="trip.km" type="number" min="0" step="1" :label="t('expenses.form.km')" />
              <DlSelect v-model="trip.type" :label="t('expenses.form.reason')" :options="tripTypes.map(option)" :placeholder="tripTypes.length ? undefined : t('expenses.form.noTypesYet')" />
              <div class="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                <span class="text-[13px] font-semibold">{{ t('expenses.form.zone') }}</span>
                <DlSegmented :model-value="trip.zone" :label="t('expenses.form.zone')" :items="zoneItems" block @update:model-value="value => setZone(trip, value)" />
                <span v-if="trip.zoneHint" class="text-xs text-dl-muted">{{ trip.zoneHint }}</span>
              </div>
            </div>
            <span v-if="errors[`days.${d}.trips.${i}`]" class="text-xs text-dl-rejected">{{ errors[`days.${d}.trips.${i}`] }}</span>
          </div>
          <DlButton variant="ghost" size="sm" icon="tabler-plus" class="self-start" @click="addTrip(day)">{{ t('expenses.form.addTrip') }}</DlButton>
          <span v-if="!tripTypes.length" class="text-xs text-dl-pending">{{ t('expenses.form.noTripTypes') }}</span>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-semibold">{{ t('expenses.form.nightAndMeals') }}</h3>
          <div class="grid items-end gap-2.5 lg:grid-cols-[1fr_1fr_auto]">
            <button
              v-for="stay in STAYS"
              :key="stay.value"
              type="button"
              class="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-start text-[13.5px] transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
              :class="day.type === stay.value ? 'border-2 border-dl-fg bg-dl-signal-soft' : 'border-dl-line hover:border-dl-body'"
              :aria-pressed="day.type === stay.value"
              @click="day.type = stay.value"
            >
              <span aria-hidden="true">{{ stay.icon }}</span>
              <span><b class="block font-semibold">{{ t(`expenses.form.stayChoice.${stay.value}`) }}</b><small class="text-xs text-dl-muted">{{ t(`expenses.form.stayHint.${stay.value}`) }}</small></span>
            </button>
            <div class="flex flex-col gap-1.5">
              <span class="text-[13px] font-semibold">{{ t('expenses.form.meals') }}</span>
              <div class="flex items-center gap-2">
                <DlIconButton icon="tabler-minus" variant="outline" :size="36" :label="t('expenses.form.lessMeals')" :disabled="day.meals <= 0" @click="day.meals = Math.max(0, day.meals - 1)" />
                <strong class="w-8 text-center text-lg tabular-nums" aria-live="polite">{{ day.meals }}</strong>
                <DlIconButton icon="tabler-plus" variant="outline" :size="36" :label="t('expenses.form.moreMeals')" :disabled="day.meals >= 10" @click="day.meals = Math.min(10, day.meals + 1)" />
              </div>
            </div>
          </div>
          <span v-if="amounts[d] && amounts[d]!.meals.typed > amounts[d]!.meals.max" class="text-xs text-dl-pending">
            {{ t('expenses.form.mealsOver', { max: n(amounts[d]!.meals.max) }, amounts[d]!.meals.max) }}
          </span>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-semibold">{{ t('expenses.panel.costs') }}</h3>
          <div v-for="(cost, i) in day.costs" :key="cost.key" class="grid items-end gap-2.5 sm:grid-cols-2 lg:grid-cols-[1fr_160px_1fr_auto_auto]">
            <DlSelect v-model="cost.type" :label="t('expenses.form.costType')" :options="costTypes.map(option)" :placeholder="costTypes.length ? undefined : t('expenses.form.noTypesYet')" />
            <DlInput v-model="cost.price" type="number" min="0" step="1" :label="t('expenses.form.price')" :error="errors[`days.${d}.costs.${i}`]" />
            <DlInput v-model="cost.description" :label="t('expenses.form.costNote')" :placeholder="t('expenses.form.optional')" />
            <label class="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-dl-line px-4 text-[13px] font-semibold">
              📎 {{ cost.receiptName || t('expenses.form.addReceipt') }}
              <input type="file" accept="image/*,application/pdf" class="sr-only" @change="pickReceipt(cost, $event)">
            </label>
            <DlIconButton icon="tabler-trash" variant="ghost" :size="44" :label="t('expenses.form.removeCost')" @click="day.costs.splice(i, 1)" />
          </div>
          <DlButton variant="ghost" size="sm" icon="tabler-plus" class="self-start" @click="day.costs.push(newCost())">{{ t('expenses.form.addCost') }}</DlButton>
          <span v-if="day.costs.length && !costTypes.length" class="text-xs text-dl-pending">{{ t('expenses.form.noTripTypes') }}</span>
        </div>

        <DlInput v-model="day.comment" :label="t('expenses.panel.note')" :placeholder="t('expenses.form.optional')" />
      </section>

      <DlButton v-if="!isEdit" variant="outline" icon="tabler-plus" class="self-start" @click="addDay">{{ t('expenses.form.addDay') }}</DlButton>

      <section class="flex flex-col gap-3 rounded-3xl border-2 border-dl-fg bg-dl-paper p-4 md:p-5">
        <h2 class="text-base font-semibold">{{ t('expenses.form.total') }}</h2>
        <ExpenseAmountLines v-if="isEdit && amounts[0]" :amounts="amounts[0]!" />
        <dl v-else-if="amounts.length" class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-[13px]">
          <template v-for="(day, d) in days" :key="day.key">
            <dt class="first-letter:uppercase">{{ day.date ? text.dayLong(day.date) : t('expenses.form.dayN', { n: d + 1 }) }}</dt>
            <dd class="text-end font-semibold tabular-nums">{{ amounts[d] ? text.money(amounts[d]!.total) : '—' }}</dd>
          </template>
          <div class="col-span-2 flex justify-between border-t border-dl-line pt-2 text-[15px] font-bold">
            <dt>{{ t('expenses.form.totalDays', { n: n(days.length) }, days.length) }}</dt>
            <dd class="tabular-nums">{{ text.money(grandTotal ?? 0) }}</dd>
          </div>
        </dl>
        <p v-else class="text-[13px] text-dl-muted">{{ t('expenses.form.totalSoon') }}</p>
        <div class="flex flex-wrap justify-end gap-2.5">
          <DlButton variant="ghost" :to="backTo">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" variant="primary" :loading="saving">
            <template v-if="isEdit">{{ t('geo.save') }}</template>
            <template v-else>{{ t('expenses.form.sendDays', { n: n(days.length), amount: text.money(grandTotal ?? 0) }, days.length) }}</template>
          </DlButton>
        </div>
      </section>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { deletePack, fetchPack, updatePack, type Pack, type PackPayload } from '@/api/tenant/orders'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDateRangePicker from '@/components/DlDateRangePicker.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { PACK_TONE, useOrdersText } from './ordersDisplay'

// An offer's page: three cards edited in place (the offer, its objectives, its brackets as a table).
// Mockup: docs/design/orders-mockups/OrdersSetup.html (frames 4, 5, 11)
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useOrdersText()
const canEdit = computed(() => auth.can('orders-setup.update'))

const pack = ref<Pack | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    pack.value = await fetchPack(Number(props.id))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { pack.value = null; load() }, { immediate: true })

// One card in edit at a time; its fields start from the offer. Numbers are typed as text, as every amount field.
interface BracketRow { min_threshold: string; max_threshold: string; discount: string; or_discount: string }
type Card = 'offer' | 'objectives' | 'brackets'
const editing = ref<Card | null>(null)
const str = (value: string | number | null | undefined) => (value == null ? '' : String(Number(value)))
const form = ref({ name: '', start_date: '', end_date: '', is_active: false, objective_budget: '', target: '', purchase_order_count: '', brackets: [] as BracketRow[] })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function edit(card: Card | null) {
  const row = pack.value
  if (!row) return
  form.value = {
    name: row.name, start_date: row.start_date, end_date: row.end_date, is_active: row.is_active,
    objective_budget: str(row.objective_budget), target: str(row.target), purchase_order_count: str(row.purchase_order_count),
    brackets: (row.discount_packs ?? []).map(b => ({ min_threshold: str(b.min_threshold), max_threshold: str(b.max_threshold), discount: str(b.discount), or_discount: str(b.or_discount) })),
  }
  if (card === 'brackets' && !form.value.brackets.length) addBracket()
  errors.value = {}
  editing.value = card
}
const editingCard = (card: Card) => computed({ get: () => editing.value === card, set: value => edit(value ? card : null) })
const editOffer = editingCard('offer')
const editObjectives = editingCard('objectives')
const editBrackets = editingCard('brackets')

// A new bracket starts where the last one ends.
function addBracket() {
  const last = form.value.brackets.at(-1)
  form.value.brackets.push({ min_threshold: last?.max_threshold ?? '', max_threshold: '', discount: '', or_discount: '0' })
}
const removeBracket = (i: number) => form.value.brackets.splice(i, 1)

const num = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.').replace(/\s/g, '')))
function payload(card: Card): PackPayload {
  const f = form.value
  if (card === 'offer') return { name: f.name, start_date: f.start_date, end_date: f.end_date, is_active: f.is_active }
  if (card === 'objectives') return { objective_budget: num(f.objective_budget), target: num(f.target), purchase_order_count: num(f.purchase_order_count) }
  return {
    discount_packs: f.brackets.map(b => ({ min_threshold: num(b.min_threshold) ?? 0, max_threshold: num(b.max_threshold), discount: num(b.discount) ?? 0, or_discount: num(b.or_discount) ?? 0 })),
  }
}
async function save(card: Card) {
  if (!pack.value) return
  errors.value = {}
  saving.value = true
  try {
    pack.value = await updatePack(pack.value.id, payload(card))
    editing.value = null
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
const bracketError = (i: number, key: string) => errors.value[`discount_packs.${i}.${key}`]
const bracketErrors = computed(() => [...new Set(Object.entries(errors.value).filter(([key]) => key.startsWith('discount_packs')).map(([, message]) => message))])

async function remove() {
  if (!pack.value) return
  const ok = await confirm({ title: t('orders.packs.page.deleteTitle', { name: pack.value.name }), text: t('orders.packs.page.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deletePack(pack.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-packs' })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('orders.packs.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-packs' }">{{ t('orders.packs.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!pack">
      <DlSkeleton class="h-20 rounded-2xl" />
      <div class="grid gap-4 lg:grid-cols-2"><DlSkeleton class="h-40 rounded-3xl" /><DlSkeleton class="h-40 rounded-3xl" /></div>
      <DlSkeleton class="h-64 rounded-3xl" />
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
            <RouterLink :to="{ name: 'tenant-packs' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('orders.packs.title') }}</RouterLink>
            <span aria-hidden="true">›</span><span>{{ pack.name }}</span>
          </nav>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ pack.name }}</h1>
          <p class="flex flex-wrap items-center gap-2 text-[13px] text-dl-muted">
            <DlBadge size="sm" :tone="PACK_TONE[pack.state]" dot>{{ text.state(pack.state) }}</DlBadge>
            <span v-if="pack.created_by">{{ t('orders.read.addedBy', { name: pack.created_by.full_name, date: text.date(pack.created_at) }) }}</span>
            · {{ t('orders.read.ordersCount', pack.orders_count) }}
          </p>
        </div>
        <DlButton v-if="auth.can('orders-setup.delete')" variant="outline" icon="tabler-trash" @click="remove">{{ t('common.actions.delete') }}</DlButton>
      </div>

      <div class="grid items-start gap-4 lg:grid-cols-2">
        <div class="rounded-3xl bg-dl-paper p-4 md:p-5">
          <DlRecordSection v-model:editing="editOffer" :title="t('orders.packs.page.offer')" icon="tabler-discount" :can-edit="canEdit" :saving="saving" @save="save('offer')" @cancel="edit(null)">
            <dl class="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5">
              <dt class="text-dl-muted">{{ t('orders.packs.fields.name') }}</dt><dd>{{ pack.name }}</dd>
              <dt class="text-dl-muted">{{ t('common.dates.period') }}</dt><dd>{{ text.period(pack.start_date, pack.end_date) }}</dd>
              <dt class="text-dl-muted">{{ t('orders.packs.fields.active') }}</dt><dd>{{ pack.is_active ? t('orders.yes') : t('orders.no') }}</dd>
            </dl>
            <template #edit>
              <DlInput v-model="form.name" :label="t('orders.packs.fields.name')" :error="errors.name" />
              <DlDateRangePicker v-model:start="form.start_date" v-model:end="form.end_date" :label="t('common.dates.period')" :error="errors.start_date || errors.end_date" />
              <DlSwitch v-model="form.is_active" :label="t('orders.packs.fields.active')" />
            </template>
          </DlRecordSection>
        </div>
        <div class="rounded-3xl bg-dl-paper p-4 md:p-5">
          <DlRecordSection v-model:editing="editObjectives" :title="t('orders.packs.page.objectives')" icon="tabler-target" :can-edit="canEdit" :saving="saving" @save="save('objectives')" @cancel="edit(null)">
            <dl class="grid grid-cols-[180px_1fr] gap-x-3 gap-y-1.5">
              <dt class="text-dl-muted">{{ t('orders.packs.fields.objectiveBudget') }}</dt><dd class="tabular-nums">{{ text.amount(pack.objective_budget) }}</dd>
              <dt class="text-dl-muted">{{ t('orders.packs.fields.target') }}</dt><dd class="tabular-nums">{{ text.percent(pack.target) }}</dd>
              <dt class="text-dl-muted">{{ t('orders.packs.fields.purchaseOrderCount') }}</dt><dd class="tabular-nums">{{ pack.purchase_order_count ?? '—' }}</dd>
            </dl>
            <template #edit>
              <div class="grid gap-3 sm:grid-cols-3">
                <DlInput v-model="form.objective_budget" inputmode="decimal" :label="t('orders.packs.fields.objectiveBudget')" :error="errors.objective_budget" />
                <DlInput v-model="form.target" inputmode="decimal" :label="t('orders.packs.fields.target')" :error="errors.target" />
                <DlInput v-model="form.purchase_order_count" inputmode="numeric" :label="t('orders.packs.fields.purchaseOrderCount')" :error="errors.purchase_order_count" />
              </div>
            </template>
          </DlRecordSection>
        </div>
      </div>

      <div class="rounded-3xl bg-dl-paper p-4 md:p-5">
        <DlRecordSection v-model:editing="editBrackets" :title="t('orders.packs.page.brackets')" icon="tabler-stairs-up" :can-edit="canEdit" :saving="saving" @save="save('brackets')" @cancel="edit(null)">
          <p v-if="!pack.discount_packs?.length" class="py-2 text-dl-muted">{{ t('orders.packs.page.noBracket') }}</p>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-[13px]">
              <thead class="text-start text-xs text-dl-muted">
                <tr><th class="w-10 py-1.5 text-start font-semibold">{{ t('orders.packs.brackets.number') }}</th><th class="text-end font-semibold">{{ t('orders.packs.brackets.from') }}</th><th class="text-end font-semibold">{{ t('orders.packs.brackets.to') }}</th><th class="text-end font-semibold">{{ t('orders.packs.fields.discount') }}</th><th class="text-end font-semibold">{{ t('orders.packs.fields.orDiscount') }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in pack.discount_packs" :key="row.id" class="border-t border-dl-line-soft tabular-nums">
                  <td class="py-2 text-dl-muted">{{ i + 1 }}</td>
                  <td class="text-end">{{ text.amount(row.min_threshold) }}</td>
                  <td class="text-end">{{ row.max_threshold == null ? t('orders.packs.brackets.andMore') : text.amount(row.max_threshold) }}</td>
                  <td class="text-end font-semibold">{{ text.percent(row.discount) }}</td>
                  <td class="text-end">{{ text.percent(row.or_discount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-2 rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('orders.packs.brackets.hint') }}</p>
          <template #edit>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[640px] text-[13px]">
                <thead class="text-xs text-dl-muted">
                  <tr>
                    <th class="w-10 py-1.5 text-start font-semibold">{{ t('orders.packs.brackets.number') }}</th>
                    <th class="px-1 text-start font-semibold">{{ t('orders.packs.brackets.fromField') }}</th>
                    <th class="px-1 text-start font-semibold">{{ t('orders.packs.brackets.toField') }}</th>
                    <th class="px-1 text-start font-semibold">{{ t('orders.packs.brackets.discountField') }}</th>
                    <th class="px-1 text-start font-semibold">{{ t('orders.packs.brackets.orDiscountField') }}</th>
                    <th class="w-10" />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in form.brackets" :key="i" class="align-top">
                    <td class="pt-3 text-dl-muted">{{ i + 1 }}</td>
                    <td class="p-1"><DlInput v-model="row.min_threshold" inputmode="numeric" :label="t('orders.packs.brackets.fromField')" hide-label :error="bracketError(i, 'min_threshold') && ' '" /></td>
                    <td class="p-1"><DlInput v-model="row.max_threshold" inputmode="numeric" :label="t('orders.packs.brackets.toField')" :placeholder="t('orders.packs.brackets.andMore')" hide-label :error="bracketError(i, 'max_threshold') && ' '" /></td>
                    <td class="p-1"><DlInput v-model="row.discount" inputmode="decimal" :label="t('orders.packs.brackets.discountField')" hide-label :error="bracketError(i, 'discount') && ' '" /></td>
                    <td class="p-1"><DlInput v-model="row.or_discount" inputmode="decimal" :label="t('orders.packs.brackets.orDiscountField')" hide-label :error="bracketError(i, 'or_discount') && ' '" /></td>
                    <td class="pt-1.5"><DlIconButton icon="tabler-trash" variant="ghost" :size="32" :label="t('common.actions.delete')" @click="removeBracket(i)" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div><DlButton size="sm" variant="ghost" icon="tabler-plus" @click="addBracket">{{ t('orders.packs.brackets.add') }}</DlButton></div>
            <p v-for="message in bracketErrors" :key="message" class="rounded-xl bg-dl-rejected/10 px-3 py-2 text-xs text-dl-rejected">{{ message }}</p>
            <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('orders.packs.brackets.editHint') }}</p>
          </template>
        </DlRecordSection>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { deleteOrder, fetchOrder, fetchOrderForm, moveOrder, removeOrderPhoto, updateOrder, uploadOrderPhoto, type Order, type OrderForm, type OrderMove, type OrderPayload } from '@/api/tenant/orders'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDatePicker from '@/components/DlDatePicker.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import OrderHcpPicker from './OrderHcpPicker.vue'
import OrderLinesEditor, { type EditLine } from './OrderLinesEditor.vue'
import OrderTotalsCard, { type Totals } from './OrderTotalsCard.vue'
import OrderCancelPanel from './OrderCancelPanel.vue'
import { STATUS_TONE, SUPPLIER_TYPES, daysAgo, useOrdersText } from './ordersDisplay'
import { useOrderPreview } from './useOrderPreview'

// An order's page: the order and its lines, edited in place; the totals stay frozen (offer, bracket, prices of the
// day it was saved) and follow the preview while the lines are edited; the paper form; the history. Mockup frames 8, 11.
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const text = useOrdersText()

const order = ref<Order | null>(null)
const failed = ref(false)
const options = ref<OrderForm | null>(null)
async function load() {
  failed.value = false
  try {
    order.value = await fetchOrder(Number(props.id))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { order.value = null; load() }, { immediate: true })
fetchOrderForm().then(value => { options.value = value }).catch(() => {})
const canEdit = computed(() => !!order.value?.can?.update)
// The paper form may come after the order, until it is invoiced (docs/api/order-status.md).
const photoEditable = computed(() => !!order.value?.can?.photo)

const NONE = 0
type Card = 'order' | 'lines'
const editing = ref<Card | null>(null)
const form = ref({ ordered_at: '', supplier_hcp_id: null as number | null, comment: '' })
const lines = ref<EditLine[]>([])
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function edit(card: Card | null) {
  const row = order.value
  if (!row) return
  form.value = { ordered_at: row.ordered_at, supplier_hcp_id: row.supplier?.id ?? null, comment: row.comment ?? '' }
  lines.value = (row.lines ?? []).map(line => ({ product_id: line.product.id, name: line.product.name, quantity: String(line.quantity), product_ug_id: line.product_ug_id ?? NONE }))
  errors.value = {}
  editing.value = card
}
const editingCard = (card: Card) => computed({ get: () => editing.value === card, set: value => edit(value ? card : null) })
const editOrder = editingCard('order')
const editLines = editingCard('lines')
const packLines = computed(() => options.value?.pack_commandes.find(pack => pack.id === order.value?.pack_commande?.id)?.lines ?? [])
const minDate = computed(() => (options.value?.max_backdate_days == null ? undefined : daysAgo(options.value.max_backdate_days)))

const linesPayload = () => lines.value.map(line => ({ product_id: line.product_id, quantity: Number(line.quantity) || 0, product_ug_id: line.product_ug_id || null }))
// The preview only while the lines are edited.
const previewPayload = computed(() => (editing.value === 'lines' && order.value && lines.value.length ? {
  id: order.value.id, ordered_at: order.value.ordered_at, client_hcp_id: order.value.client!.id, supplier_hcp_id: order.value.supplier!.id,
  user_id: order.value.user?.id, visit_id: order.value.visit?.id ?? null, pack_commande_id: order.value.pack_commande?.id ?? null, comment: order.value.comment, lines: linesPayload(),
} : null))
const live = useOrderPreview(previewPayload)
const shownErrors = computed(() => ({ ...live.errors.value, ...errors.value }))

const saved = computed<Totals | null>(() => (order.value ? {
  ...order.value, pack: order.value.pack ?? null, bracket: order.value.bracket ?? null,
} : null))
const totals = computed<Totals | null>(() => (editing.value === 'lines' && live.preview.value ? live.preview.value : saved.value))

async function save(card: Card) {
  if (!order.value) return
  errors.value = {}
  saving.value = true
  const payload: OrderPayload = card === 'order'
    ? { ordered_at: form.value.ordered_at, supplier_hcp_id: form.value.supplier_hcp_id ?? undefined, comment: form.value.comment || null }
    : { lines: linesPayload() }
  try {
    order.value = await updateOrder(order.value.id, payload)
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

async function addPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !order.value) return
  try {
    await uploadOrderPhoto(order.value.id, file)
    await load()
  }
  catch (error) {
    toast.error(fieldErrors(error).photo ?? errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
async function dropPhoto() {
  if (!order.value) return
  await removeOrderPhoto(order.value.id)
  await load()
}

async function remove() {
  if (!order.value) return
  const ok = await confirm({ title: t('orders.page.deleteTitle', { number: order.value.number }), text: t('orders.page.deleteText', { client: order.value.client?.name, date: text.date(order.value.ordered_at), amount: text.amount(order.value.total_ttc) }), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteOrder(order.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-orders' })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

// The status flow (docs/api/order-status.md): the buttons the viewer may use, the steps, the cancel window.
const STEPS = ['created', 'transmitted', 'validated', 'invoiced'] as const
const reached = (step: string) => order.value?.status !== 'cancelled' && STEPS.indexOf(order.value!.status as (typeof STEPS)[number]) >= STEPS.indexOf(step as (typeof STEPS)[number])
const MOVES: { move: OrderMove; variant: 'primary' | 'outline' }[] = [
  { move: 'reopen', variant: 'outline' }, { move: 'cancel', variant: 'outline' },
  { move: 'transmit', variant: 'primary' }, { move: 'validate', variant: 'primary' }, { move: 'invoice', variant: 'primary' },
]
const moves = computed(() => MOVES.filter(item => order.value?.can?.[item.move]))
const moving = ref<OrderMove | null>(null)
const cancelling = ref(false)
const cancelError = ref('')
async function run(move: OrderMove, reason?: string) {
  if (!order.value) return
  if (move === 'cancel' && reason === undefined) {
    cancelError.value = ''
    cancelling.value = true
    return
  }
  moving.value = move
  try {
    order.value = await moveOrder(order.value.id, move, reason)
    cancelling.value = false
    editing.value = null
    toast.success(t(`orders.status.done.${move}`))
  }
  catch (error) {
    const fields = fieldErrors(error)
    if (move === 'cancel' && fields.reason) cancelError.value = fields.reason
    else toast.error(fields.status ?? errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    moving.value = null
  }
}

const historyLine = (line: NonNullable<Order['history']>[number]) => {
  const lines = (value: unknown) => (Array.isArray(value) ? value.join(', ') : '')
  if (line.event === 'created') return t('orders.page.historyCreated')
  if (['transmitted', 'validated', 'cancelled', 'reopened', 'invoiced'].includes(line.event)) {
    return line.reason ? t('orders.status.history.cancelledWhy', { reason: line.reason }) : t(`orders.status.history.${line.event}`)
  }
  if (line.new && 'lines' in line.new) return t('orders.page.historyLines', { before: lines(line.old?.lines), after: lines(line.new.lines) })
  return t('orders.page.historyChanged')
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('orders.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-orders' }">{{ t('orders.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!order">
      <DlSkeleton class="h-20 rounded-2xl" />
      <DlSkeleton class="h-64 rounded-3xl" />
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
            <RouterLink :to="{ name: 'tenant-orders' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('orders.list.title') }}</RouterLink>
            <span aria-hidden="true">›</span><span>{{ order.number }}</span>
          </nav>
          <h1 class="flex flex-wrap items-center gap-3 font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">
            {{ order.number }}
            <DlBadge size="sm" :tone="STATUS_TONE[order.status]" dot>{{ text.status(order.status) }}</DlBadge>
            <DlBadge v-if="order.pack_commande" size="sm" tone="info">{{ order.pack_commande.name }}</DlBadge>
          </h1>
          <p class="flex flex-wrap items-center gap-1.5 text-[13px] text-dl-muted">
            <span v-if="order.created_by">{{ t('orders.read.addedBy', { name: order.created_by.full_name, date: text.date(order.created_at) }) }}</span>
            <template v-if="order.visit">
              · <RouterLink :to="{ name: 'tenant-visit-detail', params: { id: order.visit.id } }" class="text-dl-cobalt no-underline hover:underline">{{ t('orders.read.visit', { date: text.date(order.visit.visit_date) }) }}</RouterLink>
            </template>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <DlButton v-if="order.can?.delete" variant="outline" icon="tabler-trash" @click="remove">{{ t('common.actions.delete') }}</DlButton>
          <DlButton v-for="item in moves" :key="item.move" :variant="item.variant" :loading="moving === item.move" @click="run(item.move)">{{ t(`orders.status.move.${item.move}`) }}</DlButton>
        </div>
      </div>

      <ol class="flex flex-wrap items-center gap-1.5 text-[13px]" :aria-label="t('orders.fields.status')">
        <template v-for="(step, i) in STEPS" :key="step">
          <li><DlBadge size="sm" :tone="reached(step) ? 'success' : 'neutral'" :class="order.status === step && 'ring-2 ring-dl-ink'">{{ text.status(step) }}</DlBadge></li>
          <li v-if="i < STEPS.length - 1" aria-hidden="true" class="text-dl-muted">→</li>
        </template>
      </ol>
      <p v-if="order.status === 'cancelled'" class="rounded-2xl bg-dl-rejected/8 px-4 py-3 text-[13.5px] text-dl-rejected">{{ t('orders.status.cancelledBanner', { reason: order.cancel_reason ?? '' }) }}</p>
      <p v-else-if="order.status === 'transmitted' && !moves.length" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13.5px] text-dl-muted">{{ t('orders.status.waiting') }}</p>
      <p v-else-if="order.status !== 'created' && !order.can?.update" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13.5px] text-dl-muted">{{ t('orders.status.locked') }}</p>

      <div class="grid items-start gap-4 xl:grid-cols-[1fr_380px]">
        <div class="flex min-w-0 flex-col gap-4">
          <div class="rounded-3xl bg-dl-paper p-4 md:p-5">
            <DlRecordSection v-model:editing="editOrder" :title="t('orders.page.order')" icon="tabler-file-invoice" :can-edit="canEdit" :saving="saving" @save="save('order')" @cancel="edit(null)">
              <dl class="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5">
                <dt class="text-dl-muted">{{ t('orders.fields.date') }}</dt><dd>{{ text.date(order.ordered_at) }}</dd>
                <dt class="text-dl-muted">{{ t('orders.fields.client') }}</dt><dd>{{ [order.client?.name, order.client?.wilaya].filter(Boolean).join(' · ') }}</dd>
                <dt class="text-dl-muted">{{ t('orders.fields.supplier') }}</dt><dd>{{ order.supplier?.name }}</dd>
                <dt class="text-dl-muted">{{ t('orders.fields.user') }}</dt><dd>{{ order.user?.full_name }}</dd>
                <dt class="text-dl-muted">{{ t('orders.fields.comment') }}</dt><dd>{{ order.comment || '—' }}</dd>
              </dl>
              <template #edit>
                <div class="grid gap-3 md:grid-cols-2">
                  <DlDatePicker v-model="form.ordered_at" :label="t('orders.fields.date')" :min="minDate" :max="daysAgo(0)" :disabled="!!order.visit" :error="errors.ordered_at" />
                  <OrderHcpPicker v-model="form.supplier_hcp_id" :label="t('orders.fields.supplier')" :types="SUPPLIER_TYPES" :initial="order.supplier ? { id: order.supplier.id, name: order.supplier.name } : null" :error="errors.supplier_hcp_id" />
                </div>
                <DlTextarea v-model="form.comment" :label="t('orders.fields.comment')" :error="errors.comment" />
                <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('orders.page.dateHint') }}</p>
              </template>
            </DlRecordSection>
          </div>

          <div class="rounded-3xl bg-dl-paper p-4 md:p-5">
            <DlRecordSection v-model:editing="editLines" :title="t('orders.form.lines')" icon="tabler-list-details" :can-edit="canEdit" :saving="saving" @save="save('lines')" @cancel="edit(null)">
              <div class="overflow-x-auto">
                <table class="w-full min-w-[640px] text-[13px]">
                  <thead class="text-xs text-dl-muted">
                    <tr>
                      <th class="py-1.5 text-start font-semibold">{{ t('orders.packCommandes.lines.product') }}</th>
                      <th class="text-end font-semibold">{{ t('orders.form.price') }}</th>
                      <th class="text-end font-semibold">{{ t('orders.packCommandes.lines.quantity') }}</th>
                      <th class="text-end font-semibold">{{ t('orders.packCommandes.lines.ug') }}</th>
                      <th class="text-end font-semibold">{{ t('orders.form.delivered') }}</th>
                      <th class="text-end font-semibold">{{ t('orders.form.totalHt') }}</th>
                      <th class="text-end font-semibold">{{ t('orders.packs.fields.discount') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="line in order.lines" :key="line.id" class="border-t border-dl-line-soft tabular-nums">
                      <td class="py-2">{{ line.product.name }} <DlBadge v-if="line.is_strategic" size="sm" tone="ink">{{ t('orders.form.strategicShort') }}</DlBadge></td>
                      <td class="text-end">{{ text.amount(line.unit_price) }}</td>
                      <td class="text-end">{{ line.quantity }}</td>
                      <td class="text-end">{{ line.ug ? `${line.ug} %` : '—' }}</td>
                      <td class="text-end">{{ line.quantity + line.free_quantity }}</td>
                      <td class="text-end">{{ text.amount(line.total) }}</td>
                      <td class="text-end">{{ Number(line.discount) ? text.amount(line.discount) : '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="mt-2 text-xs text-dl-muted">{{ t('orders.page.frozen', { date: text.date(order.ordered_at) }) }}</p>
              <template #edit>
                <OrderLinesEditor v-model="lines" :preview="live.preview.value" :pack-lines="packLines" :errors="shownErrors" />
              </template>
            </DlRecordSection>
          </div>

          <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
            <h2 class="text-[15px] font-semibold">{{ t('orders.fields.photo') }}</h2>
            <div v-if="order.photo" class="flex flex-wrap items-center gap-3 text-[13px]">
              <a v-if="order.photo.url" :href="order.photo.url" target="_blank" rel="noopener" class="text-dl-cobalt no-underline hover:underline">{{ order.photo.name }} ↗</a>
              <span v-else>{{ order.photo.name }}</span>
              <DlButton v-if="photoEditable" size="sm" variant="ghost" icon="tabler-trash" @click="dropPhoto">{{ t('common.actions.delete') }}</DlButton>
            </div>
            <p v-else class="text-[13px] text-dl-muted">{{ t('orders.page.noPhoto') }}</p>
            <input v-if="photoEditable" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="text-[13px] file:me-3 file:rounded-lg file:border file:border-dl-line file:bg-dl-paper file:px-3 file:py-1.5" :aria-label="t('orders.fields.photo')" @change="addPhoto">
          </section>

          <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
            <h2 class="text-[15px] font-semibold">{{ t('orders.page.history') }}</h2>
            <ul class="flex flex-col gap-1.5 text-[13px]">
              <li v-for="(line, i) in order.history" :key="i" class="flex flex-wrap gap-x-2">
                <span class="tabular-nums text-dl-muted">{{ text.date(line.at) }}</span>
                <span v-if="line.by" class="font-semibold">{{ line.by }}</span>
                <span>{{ historyLine(line) }}</span>
              </li>
            </ul>
          </section>
        </div>
        <OrderTotalsCard :totals="totals" :loading="editing === 'lines' && live.loading.value" :client="order.client?.name" />
      </div>
      <OrderCancelPanel v-if="cancelling" v-model:open="cancelling" :number="order.number" :saving="moving === 'cancel'" :error="cancelError" @confirm="reason => run('cancel', reason)" />
    </template>
  </div>
</template>

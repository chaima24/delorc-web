<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createOrder, fetchOrderForm, uploadOrderPhoto, type OrderForm, type OrderPayload } from '@/api/tenant/orders'
import { fetchVisit } from '@/api/tenant/visits'
import DlButton from '@/components/DlButton.vue'
import DlDatePicker from '@/components/DlDatePicker.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import OrderHcpPicker from './OrderHcpPicker.vue'
import OrderLinesEditor, { type EditLine } from './OrderLinesEditor.vue'
import OrderTotalsCard from './OrderTotalsCard.vue'
import { BUYER_TYPES, SUPPLIER_TYPES, daysAgo, packKind, useOrdersText } from './ordersDisplay'
import { useOrderPreview } from './useOrderPreview'

// « Nouvelle commande », a full page (many lines): the header 3 fields per row, the lines, the totals beside, computed
// while typing. From a visit (?visit=12), the buyer and the date come from it. Mockup frames 3, 4, 6, 7.
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const text = useOrdersText()

const options = ref<OrderForm | null>(null)
const visit = ref<{ id: number; date: string; name: string; userId: number } | null>(null)
const NONE = 0
const form = ref({ ordered_at: daysAgo(0), client_hcp_id: null as number | null, client_type: '', client_name: '', supplier_hcp_id: null as number | null, user_id: auth.user?.id ?? 0, pack_commande_id: NONE, comment: '' })
const lines = ref<EditLine[]>([])
const photo = ref<File | null>(null)
const errors = ref<Record<string, string>>({})
const saving = ref(false)

fetchOrderForm().then(value => { options.value = value })
const visitId = Number(route.query.visit) || null
if (visitId) {
  fetchVisit(visitId).then(row => {
    visit.value = { id: row.id, date: row.visit_date, name: row.target.name ?? '', userId: row.user?.id ?? 0 }
    form.value = { ...form.value, ordered_at: row.visit_date, client_hcp_id: row.target.id, client_type: row.target.kind ?? '', client_name: row.target.name ?? '', user_id: row.user?.id ?? form.value.user_id }
  })
}

const minDate = computed(() => (options.value?.max_backdate_days == null ? undefined : daysAgo(options.value.max_backdate_days)))
const people = computed(() => (options.value?.people ?? []).map(person => ({ value: person.id, label: person.full_name })))
// Only the packs for this kind of buyer.
const packs = computed(() => (options.value?.pack_commandes ?? []).filter(pack => form.value.client_type && pack.client_type === packKind(form.value.client_type)))
const packItems = computed(() => [{ value: NONE, label: t('orders.form.noPack') }, ...packs.value.map(pack => ({ value: pack.id, label: pack.name }))])
const pack = computed(() => packs.value.find(row => row.id === form.value.pack_commande_id) ?? null)
const packLines = computed(() => pack.value?.lines ?? [])

// Choosing a pack fills its lines and keeps the others.
watch(() => form.value.pack_commande_id, () => {
  const others = lines.value.filter(line => !packLines.value.some(row => row.product_id === line.product_id))
  lines.value = [...packLines.value.map(row => ({ product_id: row.product_id, name: row.name, quantity: String(row.quantity), product_ug_id: row.product_ug_id ?? NONE })), ...others]
})
function pickClient(hcp: { name: string; type: string }) {
  form.value.client_type = hcp.type
  form.value.client_name = hcp.name
  if (!packs.value.some(row => row.id === form.value.pack_commande_id)) form.value.pack_commande_id = NONE
}

const payload = computed<OrderPayload | null>(() => {
  const f = form.value
  if (!f.client_hcp_id || !f.supplier_hcp_id || !lines.value.length) return null
  return {
    ordered_at: f.ordered_at, client_hcp_id: f.client_hcp_id, supplier_hcp_id: f.supplier_hcp_id, user_id: f.user_id || undefined,
    visit_id: visit.value?.id ?? null, pack_commande_id: f.pack_commande_id || null, comment: f.comment || null,
    lines: lines.value.map(line => ({ product_id: line.product_id, quantity: Number(line.quantity) || 0, product_ug_id: line.product_ug_id || null })),
  }
})
const live = useOrderPreview(payload)
const shownErrors = computed(() => ({ ...live.errors.value, ...errors.value }))

async function save() {
  if (!payload.value) {
    errors.value = { lines: t('orders.form.incomplete') }
    return
  }
  errors.value = {}
  saving.value = true
  try {
    const created = await createOrder(payload.value)
    if (photo.value) await uploadOrderPhoto(created.id, photo.value)
    toast.success(t('orders.form.done', { number: created.number }))
    router.push({ name: 'tenant-order', params: { id: created.id } })
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
const back = () => (visit.value ? router.push({ name: 'tenant-visit-detail', params: { id: visit.value.id } }) : router.push({ name: 'tenant-orders' }))
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
          <RouterLink v-if="visit" :to="{ name: 'tenant-visit-detail', params: { id: visit.id } }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('orders.form.fromVisitCrumb', { name: visit.name, date: text.date(visit.date) }) }}</RouterLink>
          <RouterLink v-else :to="{ name: 'tenant-orders' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('orders.list.title') }}</RouterLink>
          <span aria-hidden="true">›</span><span>{{ t('orders.form.title') }}</span>
        </nav>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ t('orders.form.title') }}</h1>
      </div>
      <div class="flex gap-2">
        <DlButton variant="ghost" @click="back">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton variant="dark" icon="tabler-check" :loading="saving" @click="save">{{ t('orders.form.save') }}</DlButton>
      </div>
    </div>

    <DlSkeleton v-if="!options || (visitId && !visit)" class="h-64 rounded-3xl" />
    <template v-else>
      <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
        <p v-if="visit" class="rounded-xl bg-dl-mist px-3 py-2 text-[13px] text-dl-muted">{{ t('orders.form.fromVisit', { name: visit.name, date: text.date(visit.date) }) }}</p>
        <div class="grid gap-3 md:grid-cols-3">
          <DlDatePicker v-model="form.ordered_at" :label="t('orders.fields.date')" :min="minDate" :max="daysAgo(0)" :disabled="!!visit" :error="shownErrors.ordered_at" />
          <DlInput v-if="visit" :model-value="visit.name" :label="t('orders.fields.client')" disabled />
          <OrderHcpPicker v-else v-model="form.client_hcp_id" :label="t('orders.fields.client')" :types="BUYER_TYPES" :error="shownErrors.client_hcp_id" @picked="pickClient" />
          <OrderHcpPicker v-model="form.supplier_hcp_id" :label="t('orders.fields.supplier')" :types="SUPPLIER_TYPES" :error="shownErrors.supplier_hcp_id" />
          <DlSelect v-if="people.length > 1 && !visit" v-model="form.user_id" :label="t('orders.fields.user')" :options="people" />
          <DlInput v-else :model-value="options.people.find(person => person.id === form.user_id)?.full_name ?? auth.user?.name ?? ''" :label="t('orders.fields.user')" disabled />
          <DlSelect v-model="form.pack_commande_id" :label="t('orders.fields.pack')" :options="packItems" :disabled="!form.client_type" />
          <label class="flex flex-col gap-1.5 text-[13px] font-semibold">
            {{ t('orders.fields.photo') }}
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="text-[13px] font-normal file:me-3 file:rounded-lg file:border file:border-dl-line file:bg-dl-paper file:px-3 file:py-1.5" @change="photo = ($event.target as HTMLInputElement).files?.[0] ?? null">
          </label>
        </div>
        <DlTextarea v-model="form.comment" :label="t('orders.fields.comment')" :error="shownErrors.comment" />
        <p v-if="shownErrors.user_id || shownErrors.visit_id || shownErrors.pack_commande_id" class="text-xs text-dl-rejected">{{ shownErrors.user_id || shownErrors.visit_id || shownErrors.pack_commande_id }}</p>
      </section>

      <div class="grid items-start gap-4 xl:grid-cols-[1fr_380px]">
        <section class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
          <header class="flex flex-wrap items-baseline gap-2">
            <h2 class="text-[15px] font-semibold">{{ t('orders.form.lines') }}</h2>
            <span class="text-xs text-dl-muted">{{ t('orders.form.linesHint') }}</span>
          </header>
          <OrderLinesEditor v-model="lines" :preview="live.preview.value" :pack-lines="packLines" :errors="shownErrors" />
        </section>
        <OrderTotalsCard :totals="payload ? live.preview.value : null" :loading="live.loading.value" :client="form.client_name" />
      </div>
    </template>
  </div>
</template>

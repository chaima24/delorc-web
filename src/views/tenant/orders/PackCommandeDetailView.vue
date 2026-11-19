<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { deletePackCommande, fetchPackCommande, updatePackCommande, type ClientType, type PackCommande } from '@/api/tenant/orders'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import { useOrdersText } from './ordersDisplay'
import { usePackProducts } from './usePackProducts'

// A pack's page: the pack card and its products as a table, both edited in place. Products are picked with the
// search select with chips, then one row each: quantity, free units, modifiable. Mockup frame 9.
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useOrdersText()
const canEdit = computed(() => auth.can('orders-setup.update'))
const lookups = usePackProducts()

const pack = ref<PackCommande | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    pack.value = await fetchPackCommande(Number(props.id))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { pack.value = null; load() }, { immediate: true })

// No free units = 0 in the select (a select can't hold an empty value).
const NONE = 0
interface Line { product_id: number; name: string; quantity: string; product_ug_id: number; is_modifiable: boolean }
type Card = 'pack' | 'products'
const editing = ref<Card | null>(null)
const form = ref({ name: '', client_type: 'pharmacy' as ClientType, description: '', is_active: true, lines: [] as Line[] })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function edit(card: Card | null) {
  const row = pack.value
  if (!row) return
  form.value = {
    name: row.name, client_type: row.client_type, description: row.description ?? '', is_active: row.is_active,
    lines: (row.products ?? []).map(line => ({ product_id: line.product.id, name: line.product.name, quantity: String(line.quantity), product_ug_id: line.product_ug?.id ?? NONE, is_modifiable: line.is_modifiable })),
  }
  errors.value = {}
  editing.value = card
}
const editingCard = (card: Card) => computed({ get: () => editing.value === card, set: value => edit(value ? card : null) })
const editPack = editingCard('pack')
const editProducts = editingCard('products')

const types = computed(() => (['pharmacy', 'wholesaler'] as const).map(value => ({ value, label: text.clientType(value) })))
const clientType = computed({ get: () => form.value.client_type as string, set: value => { form.value.client_type = value as ClientType } })

// The chips say which products are in the pack; a new one gets a row with quantity 1.
const picked = computed({
  get: () => form.value.lines.map(line => line.product_id),
  set: (ids: number[]) => {
    const kept = form.value.lines.filter(line => ids.includes(line.product_id))
    const added = ids.filter(id => !kept.some(line => line.product_id === id)).map(id => ({
      product_id: id, name: lookups.items.value.find(item => item.value === id)?.label ?? '', quantity: '1', product_ug_id: NONE, is_modifiable: false,
    }))
    form.value.lines = [...kept, ...added]
  },
})
const ugOptions = (line: Line) => [
  { value: NONE, label: t('orders.packCommandes.lines.noUg') },
  ...lookups.options(line.product_id).map(option => ({ value: option.id, label: `${option.ug} %` })),
]
const removeLine = (i: number) => form.value.lines.splice(i, 1)
const lineError = (i: number) => ['product_id', 'quantity', 'product_ug_id'].map(key => errors.value[`products.${i}.${key}`]).find(Boolean)

async function save(card: Card) {
  if (!pack.value) return
  errors.value = {}
  saving.value = true
  const f = form.value
  try {
    pack.value = await updatePackCommande(pack.value.id, card === 'pack'
      ? { name: f.name, client_type: f.client_type, description: f.description || null, is_active: f.is_active }
      : { products: f.lines.map(line => ({ product_id: line.product_id, quantity: Number(line.quantity), product_ug_id: line.product_ug_id || null, is_modifiable: line.is_modifiable })) })
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

async function remove() {
  if (!pack.value) return
  const ok = await confirm({ title: t('orders.packCommandes.page.deleteTitle', { name: pack.value.name }), text: t('orders.packCommandes.page.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deletePackCommande(pack.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-pack-commandes' })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('orders.packCommandes.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-pack-commandes' }">{{ t('orders.packCommandes.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!pack">
      <DlSkeleton class="h-20 rounded-2xl" />
      <DlSkeleton class="h-40 rounded-3xl" />
      <DlSkeleton class="h-64 rounded-3xl" />
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
            <RouterLink :to="{ name: 'tenant-pack-commandes' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('orders.packCommandes.title') }}</RouterLink>
            <span aria-hidden="true">›</span><span>{{ pack.name }}</span>
          </nav>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ pack.name }}</h1>
          <p class="flex flex-wrap items-center gap-2 text-[13px] text-dl-muted">
            <DlBadge size="sm">{{ text.clientType(pack.client_type) }}</DlBadge>
            <span v-if="pack.created_by">{{ t('orders.read.addedBy', { name: pack.created_by.full_name, date: text.date(pack.created_at) }) }}</span>
            · {{ t('orders.read.ordersCount', pack.orders_count) }}
          </p>
        </div>
        <DlButton v-if="auth.can('orders-setup.delete')" variant="outline" icon="tabler-trash" @click="remove">{{ t('common.actions.delete') }}</DlButton>
      </div>

      <div class="rounded-3xl bg-dl-paper p-4 md:p-5">
        <DlRecordSection v-model:editing="editPack" :title="t('orders.packCommandes.page.pack')" icon="tabler-package" :can-edit="canEdit" :saving="saving" @save="save('pack')" @cancel="edit(null)">
          <dl class="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5">
            <dt class="text-dl-muted">{{ t('orders.packCommandes.fields.name') }}</dt><dd>{{ pack.name }}</dd>
            <dt class="text-dl-muted">{{ t('orders.packCommandes.fields.for') }}</dt><dd>{{ text.clientType(pack.client_type) }}</dd>
            <dt class="text-dl-muted">{{ t('orders.packCommandes.fields.description') }}</dt><dd>{{ pack.description || '—' }}</dd>
            <dt class="text-dl-muted">{{ t('orders.packCommandes.fields.active') }}</dt><dd>{{ pack.is_active ? t('orders.yes') : t('orders.no') }}</dd>
          </dl>
          <template #edit>
            <div class="grid gap-3 md:grid-cols-2">
              <DlInput v-model="form.name" :label="t('orders.packCommandes.fields.name')" :error="errors.name" />
              <div class="flex flex-col gap-1.5">
                <span class="text-[13px] font-semibold">{{ t('orders.packCommandes.fields.for') }}</span>
                <DlSegmented v-model="clientType" :label="t('orders.packCommandes.fields.for')" :items="types" block />
              </div>
            </div>
            <DlTextarea v-model="form.description" :label="t('orders.packCommandes.fields.description')" :error="errors.description" />
            <DlSwitch v-model="form.is_active" :label="t('orders.packCommandes.fields.active')" />
          </template>
        </DlRecordSection>
      </div>

      <div class="rounded-3xl bg-dl-paper p-4 md:p-5">
        <DlRecordSection v-model:editing="editProducts" :title="t('orders.packCommandes.page.products')" icon="tabler-pill" :can-edit="canEdit" :saving="saving" @save="save('products')" @cancel="edit(null)">
          <p v-if="!pack.products?.length" class="py-2 text-dl-muted">{{ t('orders.packCommandes.page.noProduct') }}</p>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-[13px]">
              <thead class="text-xs text-dl-muted">
                <tr><th class="py-1.5 text-start font-semibold">{{ t('orders.packCommandes.lines.product') }}</th><th class="text-end font-semibold">{{ t('orders.packCommandes.lines.quantity') }}</th><th class="text-end font-semibold">{{ t('orders.packCommandes.lines.ug') }}</th><th class="ps-4 text-start font-semibold">{{ t('orders.packCommandes.lines.modifiable') }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="line in pack.products" :key="line.id" class="border-t border-dl-line-soft">
                  <td class="py-2">{{ line.product.name }}</td>
                  <td class="text-end tabular-nums">{{ line.quantity }}</td>
                  <td class="text-end tabular-nums">{{ line.product_ug ? `${line.product_ug.ug} %` : '—' }}</td>
                  <td class="ps-4">
                    <DlBadge v-if="line.is_modifiable" size="sm" tone="success">{{ t('orders.packCommandes.lines.atLeast', { count: line.quantity }) }}</DlBadge>
                    <DlBadge v-else size="sm">{{ t('orders.packCommandes.lines.fixed') }}</DlBadge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <template #edit>
            <CheckList
              v-model="picked"
              :legend="t('orders.packCommandes.lines.pick')"
              :selected-label="t('orders.packCommandes.read.productsCount', picked.length)"
              :search-label="t('orders.packCommandes.lines.search')"
              :items="lookups.items.value"
              :empty-text="t('orders.packCommandes.lines.noProducts')"
              :error="errors.products"
            />
            <div v-if="form.lines.length" class="overflow-x-auto">
              <table class="w-full min-w-[720px] text-[13px]">
                <thead class="text-xs text-dl-muted">
                  <tr>
                    <th class="py-1.5 text-start font-semibold">{{ t('orders.packCommandes.lines.product') }}</th>
                    <th class="w-36 px-1 text-start font-semibold">{{ t('orders.packCommandes.lines.quantityField') }}</th>
                    <th class="w-48 px-1 text-start font-semibold">{{ t('orders.packCommandes.lines.ug') }}</th>
                    <th class="w-56 px-1 text-start font-semibold">{{ t('orders.packCommandes.lines.modifiable') }}</th>
                    <th class="w-10" />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(line, i) in form.lines" :key="line.product_id" class="border-t border-dl-line-soft align-top">
                    <td class="py-3 pe-2">
                      {{ line.name }}
                      <p v-if="lineError(i)" class="mt-1 text-xs text-dl-rejected">{{ lineError(i) }}</p>
                    </td>
                    <td class="p-1"><DlInput v-model="line.quantity" inputmode="numeric" :label="t('orders.packCommandes.lines.quantityField')" hide-label :error="errors[`products.${i}.quantity`] && ' '" /></td>
                    <td class="p-1"><DlSelect v-model="line.product_ug_id" :label="t('orders.packCommandes.lines.ug')" hide-label :options="ugOptions(line)" /></td>
                    <td class="p-1 pt-3.5">
                      <DlSwitch v-model="line.is_modifiable" :label="line.is_modifiable ? t('orders.packCommandes.lines.atLeast', { count: line.quantity }) : t('orders.packCommandes.lines.fixed')" />
                    </td>
                    <td class="pt-1.5"><DlIconButton icon="tabler-trash" variant="ghost" :size="32" :label="t('common.actions.delete')" @click="removeLine(i)" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('orders.packCommandes.lines.hint') }}</p>
          </template>
        </DlRecordSection>
      </div>
    </template>
  </div>
</template>

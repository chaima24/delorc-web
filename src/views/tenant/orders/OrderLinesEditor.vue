<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { OrderPreview } from '@/api/tenant/orders'
import DlBadge from '@/components/DlBadge.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import { useOrdersText } from './ordersDisplay'
import { usePackProducts } from './usePackProducts'

/** A line while typing. No free units = 0 (a select can't hold an empty value). */
export interface EditLine { product_id: number; name: string; quantity: string; product_ug_id: number }
export interface PackLine { product_id: number; quantity: number; product_ug_id: number | null; is_modifiable: boolean }

// The order's lines: products picked with the search select with chips, then one row each (quantity, free units).
// Prices and totals come from the preview; a pack's line can't be removed, a fixed one can't change. Mockup frames 3, 4.
const props = defineProps<{ preview: OrderPreview | null; packLines: PackLine[]; errors: Record<string, string> }>()
const lines = defineModel<EditLine[]>({ required: true })
const { t } = useI18n()
const text = useOrdersText()
const lookups = usePackProducts()

const NONE = 0
const byProduct = computed(() => new Map((props.preview?.lines ?? []).map(line => [line.product_id, line])))
const packOf = (id: number) => props.packLines.find(line => line.product_id === id)

const picked = computed({
  get: () => lines.value.map(line => line.product_id),
  set: (ids: number[]) => {
    // A pack's products stay.
    const kept = lines.value.filter(line => ids.includes(line.product_id) || packOf(line.product_id))
    const added = ids.filter(id => !kept.some(line => line.product_id === id))
      .map(id => ({ product_id: id, name: lookups.items.value.find(item => item.value === id)?.label ?? '', quantity: '1', product_ug_id: NONE }))
    lines.value = [...kept, ...added]
  },
})
const ugOptions = (line: EditLine) => [
  { value: NONE, label: t('orders.packCommandes.lines.noUg') },
  ...lookups.options(line.product_id).map(option => ({ value: option.id, label: `${option.ug} %` })),
]
const remove = (i: number) => lines.value.splice(i, 1)
const lineError = (i: number) => ['product_id', 'quantity', 'product_ug_id'].map(key => props.errors[`lines.${i}.${key}`]).find(Boolean)
const delivered = (line: EditLine) => {
  const row = byProduct.value.get(line.product_id)
  return row ? Number(line.quantity || 0) + row.free_quantity : Number(line.quantity || 0)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <CheckList
      v-model="picked"
      :legend="t('orders.form.addProducts')"
      :selected-label="t('orders.packCommandes.read.productsCount', lines.length)"
      :search-label="t('orders.packCommandes.lines.search')"
      :items="lookups.items.value"
      :empty-text="t('orders.packCommandes.lines.noProducts')"
      :error="errors.lines"
    />
    <div v-if="lines.length" class="overflow-x-auto">
      <table class="w-full min-w-[820px] text-[13px]">
        <thead class="text-xs text-dl-muted">
          <tr>
            <th class="py-1.5 text-start font-semibold">{{ t('orders.packCommandes.lines.product') }}</th>
            <th class="text-end font-semibold">{{ t('orders.form.price') }}</th>
            <th class="w-32 px-1 text-start font-semibold">{{ t('orders.packCommandes.lines.quantityField') }}</th>
            <th class="w-40 px-1 text-start font-semibold">{{ t('orders.packCommandes.lines.ug') }}</th>
            <th class="text-end font-semibold">{{ t('orders.form.delivered') }}</th>
            <th class="text-end font-semibold">{{ t('orders.form.totalHt') }}</th>
            <th class="text-end font-semibold">{{ t('orders.packs.fields.discount') }}</th>
            <th class="w-10" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, i) in lines" :key="line.product_id" class="border-t border-dl-line-soft align-top">
            <td class="py-3 pe-2">
              <span class="font-semibold">{{ line.name }}</span>
              <span class="ms-1 inline-flex gap-1 align-middle">
                <DlBadge v-if="byProduct.get(line.product_id)?.is_strategic" size="sm" tone="ink">{{ t('orders.form.strategicShort') }}</DlBadge>
                <DlBadge v-if="packOf(line.product_id)" size="sm" tone="info">{{ packOf(line.product_id)!.is_modifiable ? t('orders.packCommandes.lines.atLeast', { count: packOf(line.product_id)!.quantity }) : t('orders.packCommandes.lines.fixed') }}</DlBadge>
              </span>
              <p v-if="byProduct.get(line.product_id) && !byProduct.get(line.product_id)!.is_discountable" class="text-xs text-dl-muted">{{ t('orders.form.notDiscountable') }}</p>
              <p v-if="lineError(i)" class="mt-1 text-xs text-dl-rejected">{{ lineError(i) }}</p>
            </td>
            <td class="pt-3 text-end tabular-nums">{{ text.amount(byProduct.get(line.product_id)?.unit_price) }}</td>
            <td class="p-1"><DlInput v-model="line.quantity" inputmode="numeric" :label="t('orders.packCommandes.lines.quantityField')" hide-label :disabled="packOf(line.product_id) && !packOf(line.product_id)!.is_modifiable" :error="errors[`lines.${i}.quantity`] && ' '" /></td>
            <td class="p-1"><DlSelect v-model="line.product_ug_id" :label="t('orders.packCommandes.lines.ug')" hide-label :options="ugOptions(line)" :disabled="!!packOf(line.product_id)" /></td>
            <td class="pt-3 text-end tabular-nums">{{ delivered(line) }}</td>
            <td class="pt-3 text-end tabular-nums">{{ text.amount(byProduct.get(line.product_id)?.total) }}</td>
            <td class="pt-3 text-end tabular-nums">{{ byProduct.get(line.product_id)?.is_discountable && preview?.discount_rate ? text.percent(preview.discount_rate) : '—' }}</td>
            <td class="pt-1.5"><DlIconButton v-if="!packOf(line.product_id)" icon="tabler-trash" variant="ghost" :size="32" :label="t('common.actions.delete')" @click="remove(i)" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

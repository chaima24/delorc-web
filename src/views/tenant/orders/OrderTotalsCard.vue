<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DiscountPack } from '@/api/tenant/orders'
import { useOrdersText } from './ordersDisplay'

/** What the card shows: the preview while typing, or the order as it was saved. */
export interface Totals {
  total_ht: number | string
  total_strategic: number | string
  total_discount: number | string
  total_tva: number | string
  total_ttc: number | string
  discount_source: 'bracket' | 'negotiated' | null
  discount_rate: number | string
  strategic_percentage: number | null
  boxes: { paid: number; free: number }
  pack: { id: number; name: string } | null
  bracket: { id?: number; min_threshold: number; max_threshold: number | null } | null
  brackets?: DiscountPack[]
  next_bracket?: { min_threshold: number; discount: string; missing: number } | null
}

// The totals, computed by the API: the offer's bracket highlighted, « encore X DA pour passer à 6 % ». Mockup frame 3.
const props = defineProps<{ totals: Totals | null; loading?: boolean; client?: string | null }>()
const { t } = useI18n()
const text = useOrdersText()

const share = computed(() => {
  const ht = Number(props.totals?.total_ht ?? 0)
  return ht > 0 ? Math.round(Number(props.totals!.total_strategic) / ht * 100) : 0
})
const rows = computed(() => {
  const x = props.totals
  if (!x) return []
  const reached = x.strategic_percentage != null && share.value >= x.strategic_percentage
  return [
    { label: t('orders.form.totalHt'), value: text.amount(x.total_ht) },
    { label: t('orders.form.strategic'), value: `${text.amount(x.total_strategic)} · ${share.value} %${x.discount_source === 'bracket' && x.strategic_percentage != null ? ` ${reached ? '≥' : '<'} ${x.strategic_percentage} %` : ''}` },
    ...(x.discount_source === 'negotiated'
      ? [{ label: t('orders.form.negotiated'), value: text.percent(x.discount_rate) }]
      : [
          { label: t('orders.form.offer'), value: x.pack?.name ?? t('orders.form.noOffer') },
          { label: t('orders.form.bracket'), value: x.bracket ? `${text.amount(x.bracket.min_threshold)} → ${x.bracket.max_threshold == null ? t('orders.packs.brackets.andMore') : text.amount(x.bracket.max_threshold)}` : '—' },
        ]),
    { label: t('orders.packs.fields.discount'), value: `${text.percent(x.discount_rate)} · ${text.amount(x.total_discount)}` },
    { label: t('orders.form.tva'), value: text.amount(x.total_tva) },
    { label: t('orders.form.totalTtc'), value: text.amount(x.total_ttc), strong: true },
    { label: t('orders.form.boxes'), value: t('orders.form.boxesValue', { paid: x.boxes.paid, free: x.boxes.free }) },
  ]
})
</script>

<template>
  <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-busy="loading || undefined">
    <header class="flex items-center gap-2">
      <h2 class="flex-1 text-[15px] font-semibold">{{ t('orders.form.totals') }}</h2>
      <span class="text-xs text-dl-muted">{{ loading ? t('orders.form.computing') : t('orders.form.computed') }}</span>
    </header>
    <p v-if="!totals" class="text-[13px] text-dl-muted">{{ t('orders.form.totalsEmpty') }}</p>
    <dl v-else class="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
      <template v-for="row in rows" :key="row.label">
        <dt class="text-dl-muted">{{ row.label }}</dt>
        <dd class="tabular-nums" :class="row.strong && 'text-[17px] font-bold'">{{ row.value }}</dd>
      </template>
    </dl>
    <table v-if="totals?.brackets?.length" class="w-full text-xs">
      <thead class="text-dl-muted">
        <tr><th class="py-1 text-end font-semibold">{{ t('orders.packs.brackets.from') }}</th><th class="text-end font-semibold">{{ t('orders.packs.brackets.to') }}</th><th class="text-end font-semibold">{{ t('orders.packs.fields.discount') }}</th><th class="text-end font-semibold">{{ t('orders.packs.fields.orDiscount') }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in totals.brackets" :key="row.id" class="tabular-nums" :class="row.id === totals.bracket?.id && 'bg-dl-signal-soft font-semibold'">
          <td class="py-1 text-end">{{ text.amount(row.min_threshold) }}</td>
          <td class="text-end">{{ row.max_threshold == null ? t('orders.packs.brackets.andMore') : text.amount(row.max_threshold) }}</td>
          <td class="text-end">{{ text.percent(row.discount) }}</td>
          <td class="text-end">{{ text.percent(row.or_discount) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="totals?.next_bracket" class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('orders.form.nextBracket', { amount: text.amount(totals.next_bracket.missing), rate: text.percent(totals.next_bracket.discount) }) }}</p>
    <p v-if="totals?.discount_source === 'negotiated'" class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('orders.form.negotiatedHint', { name: client ?? '' }) }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Pack } from '@/api/tenant/orders'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { PACK_TONE, useOrdersText } from './ordersDisplay'

// Reading panel: the offer's general information only. Editing is on its page. Mockup frame 3.
const props = defineProps<{ pack: Pack }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const text = useOrdersText()

const brackets = computed(() => props.pack.discount_packs ?? [])
const rows = computed(() => {
  const first = brackets.value[0]
  const range = (key: 'discount' | 'or_discount') => {
    const values = brackets.value.map(row => Number(row[key]))
    return values.length ? `${text.percent(Math.min(...values))} → ${text.percent(Math.max(...values))}` : '—'
  }
  return [
    { label: t('common.dates.period'), value: text.period(props.pack.start_date, props.pack.end_date) },
    { label: t('orders.packs.fields.active'), value: props.pack.is_active ? t('orders.yes') : t('orders.no') },
    { label: t('orders.packs.columns.brackets'), value: first ? t('orders.packs.read.brackets', { count: brackets.value.length, from: text.amount(first.min_threshold) }, brackets.value.length) : t('orders.packs.read.noBracket') },
    { label: t('orders.packs.fields.discount'), value: range('discount') },
    { label: t('orders.packs.fields.orDiscount'), value: range('or_discount') },
    { label: t('orders.packs.fields.objectiveBudget'), value: text.amount(props.pack.objective_budget) },
    { label: t('orders.packs.read.orders'), value: String(props.pack.orders_count) },
    { label: t('orders.read.added'), value: props.pack.created_by ? t('orders.read.addedBy', { date: text.date(props.pack.created_at), name: props.pack.created_by.full_name }) : text.date(props.pack.created_at) },
  ]
})
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="pack.name">
    <template #badges>
      <span class="mt-1 flex flex-wrap gap-1.5"><DlBadge size="sm" :tone="PACK_TONE[pack.state]" dot>{{ text.state(pack.state) }}</DlBadge></span>
    </template>
    <dl class="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-[13px]">
      <template v-for="row in rows" :key="row.label">
        <dt class="text-dl-muted">{{ row.label }}</dt><dd class="tabular-nums">{{ row.value }}</dd>
      </template>
    </dl>
    <template #footer>
      <DlButton variant="dark" icon-end="tabler-arrow-up-right" class="flex-1" :to="{ name: 'tenant-pack', params: { id: pack.id } }">
        {{ t('users.read.openFullPage') }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>

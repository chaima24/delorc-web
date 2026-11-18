<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Order } from '@/api/tenant/orders'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useOrdersText } from './ordersDisplay'

// Reading panel: the order's essentials and a link to its visit. Editing is on its page. Mockup frame 2.
const props = defineProps<{ order: Order }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const text = useOrdersText()

const discount = computed(() => {
  const o = props.order
  if (!Number(o.total_discount)) return text.amount(0)
  const why = o.discount_source === 'negotiated' ? t('orders.form.negotiated') : o.pack?.name ?? ''
  return `${text.amount(o.total_discount)} · ${text.percent(o.discount_rate)}${why ? ` (${why})` : ''}`
})
const rows = computed(() => [
  { label: t('orders.fields.client'), value: [props.order.client?.name, props.order.client?.wilaya].filter(Boolean).join(' · ') },
  { label: t('orders.fields.supplier'), value: props.order.supplier?.name ?? '—' },
  { label: t('orders.fields.user'), value: props.order.user?.full_name ?? '—' },
  { label: t('orders.form.lines'), value: t('orders.read.lines', { count: props.order.lines_count, paid: props.order.boxes.paid, free: props.order.boxes.free }, props.order.lines_count) },
  { label: t('orders.form.totalHt'), value: text.amount(props.order.total_ht) },
  { label: t('orders.packs.fields.discount'), value: discount.value },
  { label: t('orders.form.totalTtc'), value: text.amount(props.order.total_ttc), strong: true },
])
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="order.number">
    <template #badges>
      <span class="mt-1 flex flex-wrap items-center gap-1.5">
        <DlBadge v-if="order.pack_commande" size="sm" tone="info">{{ order.pack_commande.name }}</DlBadge>
        <span class="text-xs text-dl-muted">{{ text.date(order.ordered_at) }}</span>
      </span>
    </template>
    <dl class="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-[13px]">
      <template v-for="row in rows" :key="row.label">
        <dt class="text-dl-muted">{{ row.label }}</dt><dd class="tabular-nums" :class="row.strong && 'font-bold'">{{ row.value }}</dd>
      </template>
      <template v-if="order.visit">
        <dt class="text-dl-muted">{{ t('orders.list.source') }}</dt>
        <dd><RouterLink :to="{ name: 'tenant-visit-detail', params: { id: order.visit.id } }" class="text-dl-cobalt no-underline hover:underline">{{ t('orders.read.visit', { date: text.date(order.visit.visit_date) }) }}</RouterLink></dd>
      </template>
    </dl>
    <template #footer>
      <DlButton variant="dark" icon-end="tabler-arrow-up-right" class="flex-1" :to="{ name: 'tenant-order', params: { id: order.id } }">{{ t('users.read.openFullPage') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

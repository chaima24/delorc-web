<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PackCommande } from '@/api/tenant/orders'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useOrdersText } from './ordersDisplay'

// Reading panel: the pack's general information only. Editing is on its page. Mockup frame 8.
const props = defineProps<{ pack: PackCommande }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const text = useOrdersText()

const rows = computed(() => {
  const lines = props.pack.products ?? []
  const count = lines.length || props.pack.products_count || 0
  return [
    { label: t('orders.packCommandes.fields.description'), value: props.pack.description || '—' },
    { label: t('orders.packCommandes.columns.products'), value: t('orders.packCommandes.read.products', { count, modifiable: lines.filter(line => line.is_modifiable).length }, count) },
    { label: t('orders.packCommandes.read.withUg'), value: String(lines.filter(line => line.product_ug).length) },
    { label: t('orders.packs.read.orders'), value: String(props.pack.orders_count) },
    { label: t('orders.read.added'), value: props.pack.created_by ? t('orders.read.addedBy', { date: text.date(props.pack.created_at), name: props.pack.created_by.full_name }) : text.date(props.pack.created_at) },
  ]
})
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="pack.name">
    <template #badges>
      <span class="mt-1 flex flex-wrap gap-1.5">
        <DlBadge size="sm">{{ text.clientType(pack.client_type) }}</DlBadge>
        <DlBadge size="sm" :tone="pack.is_active ? 'success' : 'neutral'" dot>{{ pack.is_active ? t('orders.packCommandes.filter.active') : t('orders.packCommandes.filter.off') }}</DlBadge>
      </span>
    </template>
    <dl class="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-[13px]">
      <template v-for="row in rows" :key="row.label">
        <dt class="text-dl-muted">{{ row.label }}</dt><dd>{{ row.value }}</dd>
      </template>
    </dl>
    <template #footer>
      <DlButton variant="dark" icon-end="tabler-arrow-up-right" class="flex-1" :to="{ name: 'tenant-pack-commande', params: { id: pack.id } }">
        {{ t('users.read.openFullPage') }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>

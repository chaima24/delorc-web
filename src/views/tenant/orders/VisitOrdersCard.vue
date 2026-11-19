<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useOrdersText } from './ordersDisplay'

// A done visit to a pharmacy or a wholesaler: its orders, and « Ajouter une commande » (buyer and date from the visit).
// A visit may have several orders, one per supplier. Mockup: Orders.html frame 5.
defineProps<{ visitId: number; orders: { id: number; number: string; supplier: string | null; total_ttc: string }[] }>()
const { t } = useI18n()
const auth = useAuthStore()
const text = useOrdersText()
</script>

<template>
  <section class="rounded-2xl border border-dl-line bg-dl-paper" :aria-label="t('orders.visit.title')">
    <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
      <span class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-dl-line-soft text-dl-body"><DlIcon icon="tabler-shopping-cart" :size="17" /></span>
      <h3 class="flex-1 text-sm font-semibold">{{ t('orders.visit.title') }}</h3>
      <DlButton v-if="auth.can('orders.create')" size="sm" variant="outline" icon="tabler-plus" :to="{ name: 'tenant-order-new', query: { visit: visitId } }">{{ t('orders.visit.add') }}</DlButton>
    </header>
    <ul class="flex flex-col px-3.5 pb-3 text-[13.5px]">
      <li v-for="order in orders" :key="order.id" class="flex items-center gap-3 border-b border-dl-line-soft py-2 last:border-0">
        <RouterLink :to="{ name: 'tenant-order', params: { id: order.id } }" class="font-semibold text-dl-cobalt no-underline hover:underline">{{ order.number }}</RouterLink>
        <span class="min-w-0 flex-1 truncate text-dl-muted">{{ order.supplier }}</span>
        <span class="tabular-nums">{{ text.amount(order.total_ttc) }}</span>
      </li>
      <li v-if="!orders.length" class="py-1 text-[13px] text-dl-muted">{{ t('orders.visit.none') }}</li>
    </ul>
  </section>
</template>

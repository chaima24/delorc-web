<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Product } from '@/api/tenant/products'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import ProductThumb from './ProductThumb.vue'
import { PRICE_FIELDS, useProductText } from './productForm'

// Reading panel: prices, what orders use, free units. Editing is on the full page.
// "How often it was ordered" comes back with the orders module. Mockup: docs/design/studio-mockups/Products.html (frame 2)
const props = defineProps<{ product: Product }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const text = useProductText()

const tiles = computed(() => [
  { label: t('products.fields.price'), value: text.money(props.product.price) },
  { label: t('products.fields.vat'), value: text.percent(props.product.vat) },
  { label: t('products.fields.perBox'), value: props.product.per_box ?? '—' },
])
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="product.name">
    <template #media><ProductThumb :src="product.photo?.url" size="lg" /></template>
    <template #badges>
      <span class="mt-1 flex flex-wrap gap-1.5">
        <DlBadge v-if="product.brand" size="sm">{{ product.brand.name }}</DlBadge>
        <DlBadge v-if="product.therapeutic_area" size="sm">{{ product.therapeutic_area }}</DlBadge>
      </span>
    </template>

    <div class="flex flex-col gap-3.5">
      <dl class="grid grid-cols-3 gap-2">
        <div v-for="tile in tiles" :key="tile.label" class="flex flex-col gap-0.5 rounded-2xl bg-dl-mist px-3.5 py-2.5">
          <dt class="text-[11.5px] text-dl-muted">{{ tile.label }}</dt>
          <dd class="truncate text-[15px] font-bold tabular-nums">{{ tile.value }}</dd>
        </div>
      </dl>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-2 text-sm font-semibold">{{ t('products.read.inOrders') }}</h3>
        <ul class="flex flex-col gap-1.5 text-[13px]">
          <li v-for="flag in [{ on: product.strategic, label: t('products.fields.strategic') }, { on: product.us_discountable, label: t('products.fields.discountable') }]" :key="flag.label" class="flex items-center gap-2">
            <span class="flex h-4 w-4 items-center justify-center rounded-[5px]" :class="flag.on ? 'bg-dl-ink text-dl-signal' : 'bg-dl-line-soft text-dl-muted'">
              <DlIcon :icon="flag.on ? 'tabler-check' : 'tabler-minus'" :size="11" />
            </span>
            <span :class="!flag.on && 'text-dl-muted'">{{ flag.label }}</span>
          </li>
        </ul>
        <p class="mb-1 mt-3 text-[11.5px] font-bold uppercase tracking-wide text-dl-muted">{{ t('products.fields.ugs') }}</p>
        <ul v-if="product.ugs?.length" class="flex flex-wrap gap-1.5">
          <li v-for="ug in product.ugs" :key="ug"><DlBadge size="sm">{{ ug }}</DlBadge></li>
        </ul>
        <p v-else class="text-[13px] text-dl-muted">{{ t('products.read.noUg') }}</p>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('products.read.otherPrices') }}</h3>
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <template v-for="key in PRICE_FIELDS" :key="key">
            <dt class="text-dl-muted">{{ t(`products.fields.${key}`) }}</dt><dd class="tabular-nums">{{ text.money(product[key]) }}</dd>
          </template>
        </dl>
      </section>
    </div>

    <template #footer>
      <DlButton variant="dark" icon-end="tabler-arrow-up-right" class="flex-1" :to="{ name: 'tenant-product-detail', params: { id: product.id } }">
        {{ t('users.read.openFullPage') }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>

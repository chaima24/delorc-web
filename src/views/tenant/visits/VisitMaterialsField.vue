<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { OfferedMaterial } from '@/api/tenant/materials'
import DlIcon from '@/components/DlIcon.vue'
import type { ReportForm } from './VisitReportFields.vue'

// « Matériels remis » in a visit report (docs/api/materials.md): the rep's own stock for this professional, one line per
// campaign, with what is left; the rep types the quantity on the line he wants. More than what is left is refused by
// the API. Mockup: docs/design/campaigns-mockups/Materials.html (frames 5 and 6)
const props = defineProps<{ offered: OfferedMaterial[]; errors: Record<string, string> }>()
const form = defineModel<ReportForm>({ required: true })
const { t, n } = useI18n()

const quantity = (id: number) => form.value.materials.find(row => row.material_stock_id === id)?.quantity ?? 0
function set(id: number, value: number) {
  const next = Math.max(0, value)
  const row = form.value.materials.find(line => line.material_stock_id === id)
  if (row) row.quantity = next
  else form.value.materials.push({ material_stock_id: id, quantity: next })
}
/** What is left for the rep on this line, counting back what this visit already took. */
const left = (line: OfferedMaterial) => line.left
const errorOf = (index: number) => props.errors[`materials.${index}.quantity`] ?? props.errors[`materials.${index}.material_stock_id`]
const indexOf = (id: number) => form.value.materials.filter(row => row.quantity > 0).findIndex(row => row.material_stock_id === id)
</script>

<template>
  <div class="flex flex-col gap-2">
    <p v-if="!offered.length" class="text-[13px] text-dl-muted">{{ t('materials.visit.none') }}</p>
    <div v-for="line in offered" :key="line.material_stock_id" class="flex items-center gap-3 rounded-2xl px-3 py-2.5" :class="errorOf(indexOf(line.material_stock_id)) ? 'bg-dl-rejected/8 ring-1 ring-dl-rejected' : 'bg-dl-mist'">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dl-paper"><DlIcon icon="tabler-gift" :size="18" /></span>
      <div class="min-w-0 flex-1">
        <strong class="text-sm">{{ line.materiel }}</strong> <span class="text-xs text-dl-muted">· {{ line.brand }}</span>
        <span class="ms-1.5 rounded-full bg-dl-paper px-2 py-0.5 text-[11.5px] font-semibold">{{ line.campaign.name }}</span>
        <span class="block text-xs text-dl-muted">
          {{ t('materials.visit.left', { count: n(left(line)) }) }}<template v-if="line.ended"> · {{ t('materials.visit.ended') }}</template>
        </span>
        <span v-if="errorOf(indexOf(line.material_stock_id))" class="block text-xs text-dl-rejected">{{ errorOf(indexOf(line.material_stock_id)) }}</span>
      </div>
      <div class="flex items-center overflow-hidden rounded-[10px] border border-dl-line bg-dl-paper">
        <button type="button" class="flex h-9 w-9 items-center justify-center font-bold" :aria-label="t('materials.visit.less', { name: line.materiel })" @click="set(line.material_stock_id, quantity(line.material_stock_id) - 1)">−</button>
        <input :value="quantity(line.material_stock_id)" type="number" min="0" class="h-9 w-12 border-x border-dl-line text-center font-semibold" :aria-label="t('materials.visit.quantity', { name: line.materiel })"
          @input="set(line.material_stock_id, Number(($event.target as HTMLInputElement).value) || 0)">
        <button type="button" class="flex h-9 w-9 items-center justify-center font-bold" :aria-label="t('materials.visit.more', { name: line.materiel })" @click="set(line.material_stock_id, quantity(line.material_stock_id) + 1)">+</button>
      </div>
    </div>
    <p v-if="offered.length" class="text-xs text-dl-muted">{{ t('materials.visit.hint') }}</p>
  </div>
</template>

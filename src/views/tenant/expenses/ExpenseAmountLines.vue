<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExpenseAmounts } from '@/api/tenant/expenses'
import { useExpenseText } from './expenseDisplay'

// "How it is computed": each line of a day's amount, with the cap or limit that applied.
const props = defineProps<{ amounts: ExpenseAmounts }>()
const { t, n } = useI18n()
const text = useExpenseText()

const lines = computed(() => {
  const a = props.amounts
  const out: { label: string; detail: string; amount: number; warn?: boolean }[] = []
  for (const zone of ['in', 'out'] as const) {
    const km = zone === 'in' ? a.km_in : a.km_out
    if (!km.typed) continue
    const capped = km.paid < km.typed
    out.push({
      label: t(`expenses.amounts.km.${zone}`),
      detail: capped
        ? t('expenses.amounts.kmCapped', { typed: text.km(km.typed), max: text.km(km.max ?? 0), paid: text.km(km.paid), rate: text.money(km.rate) })
        : t('expenses.amounts.kmRate', { km: text.km(km.paid), rate: text.money(km.rate) }),
      amount: km.amount,
      warn: capped,
    })
  }
  if (a.night.away) {
    out.push({
      label: t('expenses.amounts.night'),
      detail: a.night.paid
        ? (a.night.max ? t('expenses.amounts.nightOf', { number: n(a.night.number ?? 1), max: n(a.night.max) }) : '')
        : t('expenses.amounts.nightOver', { max: n(a.night.max ?? 0) }),
      amount: a.night.amount,
      warn: !a.night.paid,
    })
  }
  if (a.meals.typed || a.meals.paid) {
    const over = a.meals.typed - a.meals.paid
    out.push({
      label: t('expenses.amounts.meals', a.meals.paid),
      detail: over > 0
        ? t('expenses.amounts.mealsOver', { typed: n(a.meals.typed), max: n(a.meals.max), price: text.money(a.meals.price) })
        : t('expenses.amounts.mealsRate', { paid: n(a.meals.paid), price: text.money(a.meals.price) }),
      amount: a.meals.amount,
      warn: over > 0,
    })
  }
  if (a.other) out.push({ label: t('expenses.amounts.other'), detail: '', amount: a.other })
  return out
})
</script>

<template>
  <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-[13px]">
    <template v-for="line in lines" :key="line.label">
      <dt>
        {{ line.label }}
        <small v-if="line.detail" class="block text-xs" :class="line.warn ? 'text-dl-pending' : 'text-dl-muted'">{{ line.detail }}</small>
      </dt>
      <dd class="text-end font-semibold tabular-nums">{{ text.money(line.amount) }}</dd>
    </template>
    <dt v-if="!lines.length" class="col-span-2 text-dl-muted">{{ t('expenses.amounts.nothing') }}</dt>
    <div class="col-span-2 flex justify-between border-t border-dl-line pt-2 text-[15px] font-bold">
      <dt>{{ t('expenses.amounts.total') }}</dt>
      <dd class="tabular-nums">{{ text.money(amounts.total) }}</dd>
    </div>
  </dl>
  <p v-if="!amounts.setting_id" class="mt-2 rounded-xl bg-dl-pending/8 px-3 py-2 text-xs text-dl-pending">{{ t('expenses.amounts.noSetting') }}</p>
</template>

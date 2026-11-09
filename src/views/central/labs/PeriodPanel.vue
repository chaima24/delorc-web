<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { labsApi, type Lab, type Subscription } from '@/api/central/labs'
import { plansApi, type Plan } from '@/api/central/plans'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import DeleteSection from '../geography/DeleteSection.vue'
import { usePanelAction } from '../geography/usePanelAction'
import CurrencySelect from '../plans/CurrencySelect.vue'
import { dayFromToday, shiftDay, useLabTexts } from './useLabTexts'

/** Adds a period, or with `period` edits one: after saving, only its price and note change. */
const props = defineProps<{ lab: Lab; period?: Subscription }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [lab: Lab] }>()

const { t } = useI18n()
const { day, money } = useLabTexts()
const { errors, error, busy, run } = usePanelAction()

const plans = ref<Plan[]>([])
/** Periods come newest first: the first is the last one. */
const last = computed(() => props.lab.subscriptions[0] ?? null)
const start = last.value ? shiftDay(last.value.ends_on, 1) : dayFromToday(0)
const form = ref({
  plan_id: props.period?.plan.id ?? props.lab.plan?.id ?? 0,
  kind: 'paid' as 'trial' | 'paid',
  starts_on: start,
  ends_on: shiftDay(start, -1, 1),
  monthly_price: props.period ? String(Number(props.period.monthly_price)) : '',
  currency: props.period?.currency ?? 'DZD',
  note: props.period?.note ?? '',
})

const planOptions = computed(() => plans.value.filter((p) => p.is_active).map((p) => ({ value: p.id, label: p.name })))
const kindOptions = computed(() => (['paid', 'trial'] as const).map((value) => ({ value, label: t(`central.labs.period.${value}`) })))
const plan = computed(() => plans.value.find(({ id }) => id === form.value.plan_id))
/** A period that starts inside the last one ends it the day before. */
const cuts = computed(() => !props.period && last.value !== null && form.value.starts_on <= last.value.ends_on && form.value.starts_on > last.value.starts_on)

/** The price follows the chosen plan; it can still be changed for a discount. */
watch(plan, (chosen) => {
  if (chosen && !props.period) {
    form.value.monthly_price = String(Number(chosen.monthly_price))
    form.value.currency = chosen.currency
  }
})

onMounted(async () => {
  if (!props.period) plans.value = await plansApi.list()
})

const save = () => run(
  () => (props.period
    ? labsApi.updatePeriod(props.period.id, { monthly_price: Number(form.value.monthly_price), note: form.value.note || null })
    : labsApi.addPeriod(props.lab.id, { ...form.value, monthly_price: Number(form.value.monthly_price), note: form.value.note || null })),
  (lab) => emit('changed', lab),
)
const remove = () => run(async () => {
  await labsApi.removePeriod(props.period!.id)

  return labsApi.get(props.lab.id)
}, (lab) => emit('changed', lab))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t(period ? 'central.labs.editPeriod' : 'central.labs.addPeriod')">
    <form class="flex flex-col gap-3.5" @submit.prevent="save">
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <template v-if="period">
        <p class="text-sm"><strong>{{ period.plan.name }}</strong> · {{ t(`central.labs.period.${period.kind}`) }}<br>{{ day(period.starts_on) }} → {{ day(period.ends_on) }}</p>
      </template>
      <template v-else>
        <div><DlSelect v-model="form.plan_id" :label="t('central.labs.plan')" :options="planOptions" /><p class="mt-1 text-xs" :class="errors.plan_id ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.plan_id ?? t('central.labs.planHint') }}</p></div>
        <DlSelect v-model="form.kind" :label="t('central.labs.kind')" :options="kindOptions" />
        <div class="grid grid-cols-2 gap-2.5">
          <DlInput v-model="form.starts_on" type="date" :label="t('central.labs.startsOn')" :error="errors.starts_on" />
          <DlInput v-model="form.ends_on" type="date" :label="t('central.labs.endsOn')" :error="errors.ends_on" />
        </div>
        <p v-if="cuts" class="rounded-xl bg-dl-pending/10 px-3 py-2 text-[13px] text-dl-pending">
          {{ t('central.labs.cutWarning', { plan: last!.plan.name, date: day(shiftDay(form.starts_on, -1)) }) }}
        </p>
      </template>

      <div class="grid grid-cols-[1fr_120px] gap-2.5">
        <DlInput v-model="form.monthly_price" :label="t('central.labs.price')" inputmode="decimal" :hint="plan ? t('central.labs.priceHint', { price: money(plan.monthly_price, plan.currency) }) : undefined" :error="errors.monthly_price" />
        <CurrencySelect v-if="!period" v-model="form.currency" :error="errors.currency" />
        <DlInput v-else :model-value="period.currency" :label="t('central.plans.currency')" disabled />
      </div>
      <DlInput v-model="form.note" :label="t('central.labs.note')" :error="errors.note" />
      <p class="text-xs text-dl-muted">{{ t('central.labs.pricesHint') }}</p>

      <div class="flex gap-2">
        <DlButton type="submit" variant="primary" size="sm" :loading="busy">{{ t(period ? 'common.actions.save' : 'central.labs.addPeriodSubmit') }}</DlButton>
        <DlButton variant="outline" size="sm" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      </div>
    </form>

    <DeleteSection
      v-if="period"
      class="mt-4"
      :hint="t(period.can_remove ? 'central.labs.canRemove' : 'central.labs.cannotRemove')"
      :blocked="!period.can_remove"
      :busy="busy"
      :reset-key="period.id"
      @confirm="remove"
    />
  </DlRecordPanel>
</template>

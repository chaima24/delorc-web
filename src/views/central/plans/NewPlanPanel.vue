<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { plansApi, type Plan } from '@/api/central/plans'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { usePanelAction } from '../geography/usePanelAction'
import CurrencySelect from './CurrencySelect.vue'

const props = defineProps<{ plans: Plan[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ added: [plan: Plan] }>()

const { t } = useI18n()
const { errors, error, busy, run } = usePanelAction()
const form = ref({ name: '', description: '', monthly_price: '', currency: 'DZD', start_from: 'defaults' as string | number })

const startOptions = computed(() => [
  { value: 'defaults', label: t('central.plans.featureDefaults') },
  ...props.plans.map(({ id, name }) => ({ value: id, label: name })),
])

const add = () => run(() => plansApi.create({
  name: form.value.name,
  description: form.value.description || null,
  monthly_price: Number(form.value.monthly_price),
  currency: form.value.currency,
  start_from: form.value.start_from === 'defaults' ? null : Number(form.value.start_from),
}), (plan) => emit('added', plan))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('central.plans.add')">
    <form class="flex flex-col gap-3.5" @submit.prevent="add">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <DlInput v-model="form.name" :label="t('central.plans.name')" :hint="t('central.plans.nameHint')" :error="errors.name" />
      <DlTextarea v-model="form.description" :label="t('central.plans.description')" :error="errors.description" />
      <div class="grid grid-cols-[1fr_120px] gap-2.5">
        <DlInput v-model="form.monthly_price" :label="t('central.plans.price')" inputmode="decimal" :error="errors.monthly_price" />
        <CurrencySelect v-model="form.currency" :error="errors.currency" />
      </div>
      <p class="text-xs text-dl-muted">{{ t('central.plans.priceHint') }}</p>
      <DlSelect v-model="form.start_from" :label="t('central.plans.startFrom')" :options="startOptions" />
      <p class="-mt-2 text-xs text-dl-muted">{{ t('central.plans.startFromHint') }}</p>
      <p class="rounded-xl bg-dl-pending/10 px-3 py-2 text-[13px] text-dl-pending">{{ t('central.plans.startsActive') }}</p>
      <div class="flex gap-2">
        <DlButton type="submit" variant="primary" size="sm" :loading="busy">{{ t('central.plans.addSubmit') }}</DlButton>
        <DlButton variant="outline" size="sm" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      </div>
    </form>
  </DlRecordPanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { plansApi, type Plan } from '@/api/central/plans'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useAuthStore } from '@/stores/auth'
import DeleteSection from '../geography/DeleteSection.vue'
import { usePanelAction } from '../geography/usePanelAction'
import CurrencySelect from './CurrencySelect.vue'
import { usePlanTexts } from './usePlanTexts'

const props = defineProps<{ plan: Plan }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: []; deleted: [] }>()

const { t, d } = useI18n()
const auth = useAuthStore()
const { price } = usePlanTexts()
const { errors, error, busy, run, clear } = usePanelAction()

const editing = ref(false)
const details = ref({ name: '', description: '', monthly_price: '', currency: '' })

function reset(): void {
  const { name, description, monthly_price, currency } = props.plan
  details.value = { name, description: description ?? '', monthly_price: String(Number(monthly_price)), currency }
  editing.value = false
  clear()
}

watch(() => props.plan, reset, { immediate: true })

const save = () => run(() => plansApi.update(props.plan.id, {
  name: details.value.name,
  description: details.value.description || null,
  monthly_price: Number(details.value.monthly_price),
  currency: details.value.currency,
}), () => emit('changed'))
const switchActive = () => run(() => plansApi.update(props.plan.id, { is_active: !props.plan.is_active }), () => emit('changed'))
const remove = () => run(() => plansApi.remove(props.plan.id), () => emit('deleted'))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="plan.name">
    <template #badges>
      <div><DlBadge :tone="plan.is_active ? 'success' : 'neutral'" dot size="sm">{{ t(`central.plans.status.${plan.is_active ? 'active' : 'inactive'}`) }}</DlBadge></div>
    </template>

    <div class="flex flex-col gap-3">
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <DlRecordSection v-model:editing="editing" :title="t('central.plans.detailsTitle')" :can-edit="auth.can('plans.update')" :saving="busy" @save="save" @cancel="reset">
        <template v-if="plan.description">{{ plan.description }}<br></template>
        {{ t('central.plans.price') }}: {{ price(plan) }}<br>
        {{ t('common.list.createdAt') }}: {{ d(new Date(plan.created_at)) }}
        <template #edit>
          <DlInput v-model="details.name" :label="t('central.plans.name')" :hint="t('central.plans.nameHint')" :error="errors.name" />
          <DlTextarea v-model="details.description" :label="t('central.plans.description')" :error="errors.description" />
          <div class="grid grid-cols-[1fr_120px] gap-2.5">
            <DlInput v-model="details.monthly_price" :label="t('central.plans.price')" inputmode="decimal" :error="errors.monthly_price" />
            <CurrencySelect v-model="details.currency" :error="errors.currency" />
          </div>
          <p class="text-xs text-dl-muted">{{ t('central.plans.priceHint') }}</p>
        </template>
      </DlRecordSection>

      <DlRecordSection :title="t('central.plans.labsTitle')" :can-edit="false">
        {{ t('central.plans.labsHint', { count: plan.labs_count }) }}
      </DlRecordSection>

      <DlRecordSection v-if="auth.can('plans.update')" :title="t(`central.plans.status.${plan.is_active ? 'active' : 'inactive'}`)" :can-edit="false">
        {{ t(plan.is_active ? 'central.plans.activeHint' : 'central.plans.inactiveHint') }}
        <div class="mt-2"><DlButton variant="outline" size="sm" :loading="busy" @click="switchActive">{{ t(plan.is_active ? 'central.plans.deactivate' : 'central.plans.activate') }}</DlButton></div>
      </DlRecordSection>

      <DeleteSection
        v-if="auth.can('plans.delete')"
        :hint="t(plan.labs_count ? 'central.plans.deleteBlocked' : 'central.plans.canDelete', { count: plan.labs_count })"
        :blocked="plan.labs_count > 0"
        :busy="busy"
        :reset-key="plan.id"
        @confirm="remove"
      />
    </div>
  </DlRecordPanel>
</template>

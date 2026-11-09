<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { labFeaturesApi, type FeatureChange, type LabFeatures } from '@/api/central/labs'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import DeleteSection from '../geography/DeleteSection.vue'
import { numberOrNull, usePanelAction } from '../geography/usePanelAction'
import { usePlanTexts } from '../plans/usePlanTexts'
import { dayFromToday } from './useLabTexts'
import { useFeatureValue } from './useFeatureValue'

/** Adds a change, or with `change` edits or removes one. */
const props = defineProps<{ labId: string; tab: LabFeatures; change?: FeatureChange }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [tab: LabFeatures] }>()

const { t } = useI18n()
const { featureName } = usePlanTexts()
const { shown } = useFeatureValue()
const { errors, error, busy, run } = usePanelAction()

const form = ref({
  feature: props.change?.feature ?? props.tab.features[0]?.key ?? '',
  limit: typeof props.change?.value === 'number' ? String(props.change.value) : '',
  included: props.change?.value === true,
  starts_on: props.change?.starts_on ?? dayFromToday(0),
  ends_on: props.change?.ends_on ?? '',
  note: props.change?.note ?? '',
})

const featureOptions = computed(() => props.tab.features.map(({ key }) => ({ value: key, label: featureName(key) })))
const feature = computed(() => props.tab.features.find(({ key }) => key === form.value.feature))
const isSwitch = computed(() => feature.value?.type === 'switch')

function fields() {
  return {
    value: isSwitch.value ? form.value.included : numberOrNull(form.value.limit),
    starts_on: form.value.starts_on,
    ends_on: form.value.ends_on || null,
    note: form.value.note || null,
  }
}

const save = () => run(
  () => (props.change ? labFeaturesApi.update(props.change.id, fields()) : labFeaturesApi.add(props.labId, { feature: form.value.feature, ...fields() })),
  (tab) => emit('changed', tab),
)
const remove = () => run(async () => {
  await labFeaturesApi.remove(props.change!.id)

  return labFeaturesApi.get(props.labId)
}, (tab) => emit('changed', tab))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="change ? featureName(change.feature) : t('central.labs.features.add')" :description="change?.note ?? undefined">
    <form class="flex flex-col gap-3.5" @submit.prevent="save">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <div v-if="!change"><DlSelect v-model="form.feature" :label="t('central.labs.features.feature')" :options="featureOptions" /><p v-if="errors.feature" class="mt-1 text-xs text-dl-rejected">{{ errors.feature }}</p></div>

      <div v-if="isSwitch" class="flex flex-col gap-1">
        <DlSwitch v-model="form.included" :label="t('central.labs.features.included')" />
        <p class="text-xs" :class="errors.value ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.value ?? t('central.labs.features.planGives', { value: shown(feature!.type, feature!.plan_value) }) }}</p>
      </div>
      <DlInput
        v-else
        v-model="form.limit"
        type="number"
        min="0"
        :label="t('central.labs.features.value')"
        :placeholder="t('central.plans.unlimited')"
        :hint="feature ? t('central.labs.features.limitHint', { value: shown(feature.type, feature.plan_value) }) : undefined"
        :error="errors.value"
      />

      <div class="grid grid-cols-2 gap-2.5">
        <DlInput v-model="form.starts_on" type="date" :label="t('central.labs.features.from')" :error="errors.starts_on" />
        <DlInput v-model="form.ends_on" type="date" :label="t('central.labs.features.to')" :hint="t('central.labs.features.toHint')" :error="errors.ends_on" />
      </div>
      <DlInput v-model="form.note" :label="t('central.labs.note')" :error="errors.note" />

      <div class="flex gap-2">
        <DlButton type="submit" variant="primary" size="sm" :loading="busy">{{ t(change ? 'common.actions.save' : 'central.labs.features.addSubmit') }}</DlButton>
        <DlButton variant="outline" size="sm" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      </div>
    </form>

    <DeleteSection
      v-if="change"
      class="mt-4"
      :hint="t(change.state === 'now' && change.starts_on < dayFromToday(0) ? 'central.labs.features.endsYesterday' : 'central.labs.features.removeHint')"
      :blocked="false"
      :busy="busy"
      :reset-key="change.id"
      @confirm="remove"
    />
  </DlRecordPanel>
</template>

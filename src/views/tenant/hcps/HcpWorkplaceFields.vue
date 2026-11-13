<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import type { WorkplaceForm } from './hcpForm'
import { useHcpLookups } from './useHcpLookups'

// One workplace: organisation + speciality + first day.
defineProps<{ errors?: Record<string, string | undefined> }>()
const form = defineModel<WorkplaceForm>('form', { required: true })
const { t } = useI18n()
const lookups = useHcpLookups()

const hco = computed({
  get: () => form.value.hco_id,
  set: value => { form.value.hco_id = value == null ? null : Number(value) },
})
const speciality = computed({
  get: () => form.value.speciality_id,
  set: value => { form.value.speciality_id = value == null ? null : Number(value) },
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <DlCombobox v-model="hco" :label="t('hcps.workplaces.hco')" :options="lookups.hcoOptions.value" :error="errors?.hco_id" />
    <DlCombobox v-model="speciality" :label="t('hcps.workplaces.speciality')" :options="lookups.specialityOptions.value" :error="errors?.speciality_id" />
    <DlInput v-model="form.start_date" type="date" :label="t('hcps.workplaces.since')" :error="errors?.start_date" />
  </div>
</template>

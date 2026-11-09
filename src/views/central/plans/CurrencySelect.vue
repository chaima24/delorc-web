<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DlSelect from '@/components/DlSelect.vue'

/** The currencies offered for a plan's price. The API accepts any 3-letter code; a new one is added here. */
const CURRENCIES = ['DZD', 'EUR', 'USD']

defineProps<{ error?: string }>()
const model = defineModel<string>({ required: true })

const { t } = useI18n()
const options = computed(() => {
  // A plan saved with another code still shows it.
  const codes = CURRENCIES.includes(model.value) || !model.value ? CURRENCIES : [...CURRENCIES, model.value]

  return codes.map((code) => ({ value: code, label: code }))
})
</script>

<template>
  <div>
    <DlSelect v-model="model" :label="t('central.plans.currency')" :options="options" />
    <p v-if="error" class="mt-1 text-xs text-dl-rejected">{{ error }}</p>
  </div>
</template>

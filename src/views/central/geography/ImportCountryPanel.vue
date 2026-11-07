<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { countriesApi, type CountryImport } from '@/api/central/geography'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { usePanelAction } from './usePanelAction'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ imported: [] }>()

const { t, n } = useI18n()
const { error, busy, run } = usePanelAction()
const file = ref<File | null>(null)
const result = ref<CountryImport | null>(null)
const counts = computed(() => (result.value
  ? (['regions_added', 'wilayas_added', 'communes_added', 'unchanged'] as const).map((name) => [name, result.value![name]] as const)
  : []))

function choose(event: Event): void {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
  result.value = null
}

const send = () => file.value && run(() => countriesApi.import(file.value!), (answer) => {
  result.value = answer
  emit('imported')
})
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('central.geography.importCountry')">
    <div class="flex flex-col gap-3">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1 text-sm font-semibold">{{ t('central.geography.file') }}</h3>
        <p class="mb-3 text-[13px] text-dl-body">{{ t('central.geography.fileHint') }}</p>
        <label class="block cursor-pointer rounded-xl border border-dashed border-dl-line px-3 py-4 text-center text-[13px] hover:bg-dl-line-soft">
          <input type="file" accept=".json,application/json" class="sr-only" @change="choose">
          {{ file?.name ?? t('central.translations.chooseFile') }}
        </label>
      </section>
      <section class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px] text-dl-body">
        <h3 class="mb-1 text-sm font-semibold text-dl-fg">{{ t('central.geography.onlyAdds') }}</h3>
        {{ t('central.geography.onlyAddsHint') }}
      </section>
      <section v-if="result" class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px]">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('central.translations.lastImport') }}</h3>
        <p v-if="result.country_added" class="mb-1 text-dl-pending">{{ t('central.geography.countryAdded', { code: result.country }) }}</p>
        <p v-for="[name, count] in counts" :key="name" class="flex justify-between py-1">
          <span>{{ t(`central.geography.result.${name}`) }}</span><strong class="tabular-nums">{{ n(count) }}</strong>
        </p>
      </section>
      <DlButton variant="primary" size="sm" class="self-start" :disabled="!file" :loading="busy" @click="send">{{ t('central.translations.importFile') }}</DlButton>
    </div>
  </DlRecordPanel>
</template>

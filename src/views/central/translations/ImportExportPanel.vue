<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { translationsApi, type ImportResult } from '@/api/central/translations'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { downloadFile } from '@/composables/downloadFile'
import { useAuthStore } from '@/stores/auth'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ imported: [] }>()

const { t, n } = useI18n()
const auth = useAuthStore()

const file = ref<File | null>(null)
const result = ref<ImportResult | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)
const downloading = ref(false)

async function download(): Promise<void> {
  downloading.value = true
  error.value = null
  try {
    downloadFile(await translationsApi.export(), `delorc-translations-${new Date().toISOString().slice(0, 10)}.json`)
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    downloading.value = false
  }
}

function choose(event: Event): void {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
  result.value = null
}

async function send(): Promise<void> {
  if (!file.value) return
  busy.value = true
  error.value = null
  try {
    result.value = await translationsApi.import(file.value)
    emit('imported')
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('central.translations.importExport')" :description="t('central.translations.backupHint')">
    <div class="flex flex-col gap-3">
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <section v-if="auth.can('translations.export')" class="rounded-2xl border border-dl-line">
        <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
          <h3 class="flex-1 text-sm font-semibold">{{ t('central.translations.export') }}</h3>
          <DlButton variant="outline" size="sm" icon="tabler-download" :loading="downloading" @click="download">{{ t('central.translations.download') }}</DlButton>
        </header>
        <p class="px-3.5 pb-3 text-[13px] text-dl-body">{{ t('central.translations.exportHint') }}</p>
      </section>

      <section v-if="auth.can('translations.import')" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1 text-sm font-semibold">{{ t('central.translations.import') }}</h3>
        <p class="mb-3 text-[13px] text-dl-body">{{ t('central.translations.importHint') }}</p>
        <label class="block cursor-pointer rounded-xl border border-dashed border-dl-line px-3 py-4 text-center text-[13px] hover:bg-dl-line-soft">
          <input type="file" accept=".json,application/json" class="sr-only" @change="choose">
          {{ file?.name ?? t('central.translations.chooseFile') }}
        </label>
        <DlButton variant="primary" size="sm" class="mt-3" :disabled="!file" :loading="busy" @click="send">{{ t('central.translations.importFile') }}</DlButton>
      </section>

      <section v-if="result" class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px]">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('central.translations.lastImport') }}</h3>
        <p v-for="(count, name) in result" :key="name" class="flex justify-between py-1">
          <span>{{ t(`central.translations.result.${name}`) }}</span><strong class="tabular-nums">{{ n(count) }}</strong>
        </p>
      </section>
    </div>
  </DlRecordPanel>
</template>

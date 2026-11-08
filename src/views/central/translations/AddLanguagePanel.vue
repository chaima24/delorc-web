<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { languagesApi, type Language } from '@/api/central/languages'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'

defineProps<{ texts: number }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ added: [language: Language] }>()

const { t } = useI18n()

const form = ref({ code: '', name: '', native_name: '', direction: 'ltr' as Language['direction'], locale: '' })
const errors = ref<Record<string, string>>({})
const error = ref<string | null>(null)
const busy = ref(false)

const directionOptions = computed(() => ['ltr', 'rtl'].map((value) => ({ value, label: t(`central.languages.direction.${value}`) })))

async function add(): Promise<void> {
  busy.value = true
  errors.value = {}
  error.value = null
  try {
    emit('added', await languagesApi.create(form.value))
  } catch (failure) {
    errors.value = fieldErrors(failure)
    if (!Object.keys(errors.value).length) error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('central.languages.add')" :description="t('central.languages.addHint')">
    <form class="flex flex-col gap-3.5" @submit.prevent="add">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <DlInput v-model="form.code" :label="t('central.languages.code')" :hint="t('central.languages.codeHint')" :error="errors.code" />
      <div class="grid grid-cols-2 gap-2.5">
        <DlInput v-model="form.name" :label="t('central.languages.name')" :error="errors.name" />
        <DlInput v-model="form.native_name" :label="t('central.languages.nativeName')" :error="errors.native_name" />
      </div>
      <DlSelect v-model="form.direction" :label="t('central.languages.directionLabel')" :options="directionOptions" />
      <DlInput v-model="form.locale" :label="t('central.languages.locale')" :hint="t('central.languages.localeHint')" :error="errors.locale" />
      <p class="rounded-xl bg-dl-pending/10 px-3 py-2 text-[13px] text-dl-pending">{{ t('central.languages.startsMissing', { count: texts }) }}</p>
      <div class="flex gap-2">
        <DlButton type="submit" variant="primary" size="sm" :loading="busy">{{ t('central.languages.addSubmit') }}</DlButton>
        <DlButton variant="outline" size="sm" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      </div>
    </form>
  </DlRecordPanel>
</template>

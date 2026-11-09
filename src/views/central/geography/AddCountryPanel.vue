<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { countriesApi, type Country } from '@/api/central/geography'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { usePanelAction } from './usePanelAction'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ added: [country: Country] }>()

const { t } = useI18n()
const { errors, error, busy, run } = usePanelAction()
const form = ref({ code: '', name: '', native_name: '', phone_code: '' })

const add = () => run(() => countriesApi.create({
  code: form.value.code.toUpperCase(),
  name: form.value.name,
  native_name: form.value.native_name || null,
  phone_code: form.value.phone_code || null,
}), (country) => emit('added', country))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('central.geography.addCountry')">
    <form class="flex flex-col gap-3.5" @submit.prevent="add">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <DlInput v-model="form.code" :label="t('central.geography.code')" :hint="t('central.geography.codeHint')" :error="errors.code" />
      <div class="grid grid-cols-2 gap-2.5">
        <DlInput v-model="form.name" :label="t('central.geography.name')" :error="errors.name" />
        <DlInput v-model="form.native_name" :label="t('central.geography.nativeName')" :error="errors.native_name" />
      </div>
      <DlInput v-model="form.phone_code" :label="t('central.geography.phoneCode')" :error="errors.phone_code" />
      <p class="rounded-xl bg-dl-pending/10 px-3 py-2 text-[13px] text-dl-pending">{{ t('central.geography.startsEmpty') }}</p>
      <div class="flex gap-2">
        <DlButton type="submit" variant="primary" size="sm" :loading="busy">{{ t('central.geography.addCountrySubmit') }}</DlButton>
        <DlButton variant="outline" size="sm" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      </div>
    </form>
  </DlRecordPanel>
</template>

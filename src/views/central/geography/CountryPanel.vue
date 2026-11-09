<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { countriesApi, type Country } from '@/api/central/geography'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { downloadFile } from '@/composables/downloadFile'
import { useAuthStore } from '@/stores/auth'
import DeleteSection from './DeleteSection.vue'
import { usePanelAction } from './usePanelAction'

const props = defineProps<{ country: Country }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: []; deleted: [] }>()

const { t, n } = useI18n()
const auth = useAuthStore()
const { errors, error, busy, run, clear } = usePanelAction()

const editing = ref(false)
const details = ref({ name: '', native_name: '', phone_code: '' })

function reset(): void {
  const { name, native_name, phone_code } = props.country
  details.value = { name, native_name: native_name ?? '', phone_code: phone_code ?? '' }
  editing.value = false
  clear()
}

watch(() => props.country, reset, { immediate: true })

const save = () => run(() => countriesApi.update(props.country.code, {
  name: details.value.name,
  native_name: details.value.native_name || null,
  phone_code: details.value.phone_code || null,
}), () => emit('changed'))
const switchActive = () => run(() => countriesApi.update(props.country.code, { is_active: !props.country.is_active }), () => emit('changed'))
const remove = () => run(() => countriesApi.remove(props.country.code), () => emit('deleted'))
const download = () => run(() => countriesApi.export(props.country.code), (file) => {
  downloadFile(file, `country-${props.country.code.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`)
})
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="country.name">
    <template #media>
      <span class="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] bg-dl-ink text-[15px] font-bold text-dl-signal">{{ country.code }}</span>
    </template>
    <template #badges>
      <div><DlBadge :tone="country.is_active ? 'success' : 'neutral'" dot size="sm">{{ t(`central.geography.status.${country.is_active ? 'active' : 'inactive'}`) }}</DlBadge></div>
    </template>

    <div class="flex flex-col gap-3">
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5"><b class="font-display text-2xl font-extrabold">{{ n(country.wilayas_count) }}</b><span class="text-xs text-dl-muted">{{ t('central.geography.wilayasCount') }}</span></div>
        <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5"><b class="font-display text-2xl font-extrabold">{{ n(country.communes_count) }}</b><span class="text-xs text-dl-muted">{{ t('central.geography.communesCount') }}</span></div>
      </div>
      <DlButton variant="dark" size="sm" :to="{ name: 'central-country', params: { code: country.code } }">{{ t('central.geography.browse') }}</DlButton>

      <DlRecordSection v-model:editing="editing" :title="t('central.geography.details')" :can-edit="auth.can('geography.update')" :saving="busy" @save="save" @cancel="reset">
        {{ country.name }}<template v-if="country.native_name"> · {{ country.native_name }}</template><br>
        {{ t('central.geography.code') }}: {{ country.code }}<br>
        {{ t('central.geography.phoneCode') }}: {{ country.phone_code ?? '—' }}
        <template #edit>
          <DlInput v-model="details.name" :label="t('central.geography.name')" :error="errors.name" />
          <DlInput v-model="details.native_name" :label="t('central.geography.nativeName')" :error="errors.native_name" />
          <DlInput v-model="details.phone_code" :label="t('central.geography.phoneCode')" :error="errors.phone_code" />
        </template>
      </DlRecordSection>

      <DlRecordSection v-if="auth.can('geography.export')" :title="t('central.geography.export')" :can-edit="false">
        {{ t('central.geography.exportHint') }}
        <div class="mt-2"><DlButton variant="outline" size="sm" icon="tabler-download" :disabled="busy" @click="download">{{ t('central.geography.download') }}</DlButton></div>
      </DlRecordSection>

      <template v-if="auth.can('geography.update')">
        <DlRecordSection :title="t(`central.geography.status.${country.is_active ? 'active' : 'inactive'}`)" :can-edit="false">
          {{ t(country.is_active ? 'central.geography.activeHint' : 'central.geography.inactiveHint') }}
          <div class="mt-2"><DlButton variant="outline" size="sm" :loading="busy" @click="switchActive">{{ t(country.is_active ? 'central.geography.deactivate' : 'central.geography.activate') }}</DlButton></div>
        </DlRecordSection>
        <DeleteSection
          :hint="t(country.regions_count ? 'central.geography.countryBlocked' : 'central.geography.canDelete')"
          :blocked="country.regions_count > 0"
          :busy="busy"
          :reset-key="country.id"
          @confirm="remove"
        />
      </template>
      <p class="text-xs text-dl-muted">{{ t('central.geography.copyHint') }}</p>
    </div>
  </DlRecordPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { placesApi, type Region, type Wilaya } from '@/api/central/geography'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAuthStore } from '@/stores/auth'
import DeleteSection from './DeleteSection.vue'
import { numberOrNull, usePanelAction } from './usePanelAction'

/** A wilaya, or the form to add one when `wilaya` is null. */
const props = defineProps<{ code: string; wilaya: Wilaya | null; regions: Region[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [wilaya: Wilaya]; deleted: []; seeCommunes: [wilaya: Wilaya] }>()

const { t, n } = useI18n()
const auth = useAuthStore()
const { errors, error, busy, run, clear } = usePanelAction()
const editing = ref(false)
const form = ref({ name: '', arabic_name: '', region_id: null as number | null, phone_code: '', latitude: '' as string | number, longitude: '' as string | number })
const regionOptions = computed(() => props.regions.map(({ id, name }) => ({ value: id, label: name })))

function reset(): void {
  const wilaya = props.wilaya
  form.value = {
    name: wilaya?.name ?? '',
    arabic_name: wilaya?.arabic_name ?? '',
    region_id: wilaya?.region?.id ?? props.regions[0]?.id ?? null,
    phone_code: wilaya?.phone_code ?? '',
    latitude: wilaya?.latitude ?? '',
    longitude: wilaya?.longitude ?? '',
  }
  editing.value = !wilaya
  clear()
}

watch(() => props.wilaya, reset, { immediate: true })

function save(): Promise<void> {
  const fields = {
    name: form.value.name,
    arabic_name: form.value.arabic_name || null,
    region_id: form.value.region_id ?? undefined,
    phone_code: form.value.phone_code || null,
    latitude: numberOrNull(form.value.latitude),
    longitude: numberOrNull(form.value.longitude),
  }

  return run(
    () => (props.wilaya ? placesApi.updateWilaya(props.wilaya.id, fields) : placesApi.createWilaya(props.code, fields)),
    (wilaya) => emit('saved', wilaya),
  )
}
const remove = () => props.wilaya && run(() => placesApi.removeWilaya(props.wilaya!.id), () => emit('deleted'))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="wilaya?.name ?? t('central.geography.addWilaya')">
    <template v-if="wilaya?.region" #badges><div><DlBadge size="sm">{{ wilaya.region.name }}</DlBadge></div></template>

    <div class="flex flex-col gap-3">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <template v-if="wilaya">
        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5"><b class="font-display text-2xl font-extrabold">{{ n(wilaya.communes_count) }}</b><span class="text-xs text-dl-muted">{{ t('central.geography.communesCount') }}</span></div>
          <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5"><b class="font-display text-2xl font-extrabold">{{ wilaya.phone_code ?? '—' }}</b><span class="text-xs text-dl-muted">{{ t('central.geography.phoneCode') }}</span></div>
        </div>
        <DlButton v-if="wilaya.communes_count" variant="dark" size="sm" @click="emit('seeCommunes', wilaya)">{{ t('central.geography.seeCommunes') }}</DlButton>
      </template>

      <DlRecordSection
        v-model:editing="editing"
        :title="t('central.geography.details')"
        :can-edit="auth.can('geography.update')"
        :saving="busy"
        :save-label="wilaya ? undefined : t('central.geography.addWilaya')"
        @save="save"
        @cancel="wilaya ? reset() : (open = false)"
      >
        <template v-if="wilaya">
          {{ wilaya.name }}<template v-if="wilaya.arabic_name"> · {{ wilaya.arabic_name }}</template><br>
          {{ t('central.geography.region') }}: {{ wilaya.region?.name ?? '—' }}<br>
          {{ t('central.geography.position') }}: {{ wilaya.latitude !== null ? `${wilaya.latitude}, ${wilaya.longitude}` : '—' }}
        </template>
        <template #edit>
          <DlInput v-model="form.name" :label="t('central.geography.name')" :error="errors.name" />
          <DlInput v-model="form.arabic_name" :label="t('central.geography.arabicName')" dir="rtl" :error="errors.arabic_name" />
          <DlSelect v-model="form.region_id" :label="t('central.geography.region')" :options="regionOptions" />
          <p v-if="errors.region_id" class="text-xs font-semibold text-dl-rejected">{{ errors.region_id }}</p>
          <div class="grid grid-cols-2 gap-2.5">
            <DlInput v-model="form.latitude" :label="t('central.geography.latitude')" type="number" :error="errors.latitude" />
            <DlInput v-model="form.longitude" :label="t('central.geography.longitude')" type="number" :error="errors.longitude" />
          </div>
          <DlInput v-model="form.phone_code" :label="t('central.geography.phoneCode')" :error="errors.phone_code" />
        </template>
      </DlRecordSection>

      <DeleteSection
        v-if="wilaya && auth.can('geography.update')"
        :hint="t(wilaya.communes_count ? 'central.geography.wilayaBlocked' : 'central.geography.canDelete')"
        :blocked="wilaya.communes_count > 0"
        :busy="busy"
        :reset-key="wilaya.id"
        @confirm="remove"
      />
      <p class="text-xs text-dl-muted">{{ t('central.geography.copyHint') }}</p>
    </div>
  </DlRecordPanel>
</template>

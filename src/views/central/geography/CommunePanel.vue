<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { placesApi, type Commune, type Wilaya } from '@/api/central/geography'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useAuthStore } from '@/stores/auth'
import DeleteSection from './DeleteSection.vue'
import { numberOrNull, usePanelAction } from './usePanelAction'

/** A commune, or the form to add one when `commune` is null. */
const props = defineProps<{ code: string; commune: Commune | null; wilayas: Wilaya[]; wilayaId?: number }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [commune: Commune]; deleted: [] }>()

const { t } = useI18n()
const auth = useAuthStore()
const { errors, error, busy, run, clear } = usePanelAction()
const editing = ref(false)
const form = ref({ name: '', arabic_name: '', wilaya_id: null as number | null, post_code: '', latitude: '' as string | number, longitude: '' as string | number })
const wilayaOptions = computed(() => props.wilayas.map(({ id, name }) => ({ value: id, label: name })))

function reset(): void {
  const commune = props.commune
  form.value = {
    name: commune?.name ?? '',
    arabic_name: commune?.arabic_name ?? '',
    wilaya_id: commune?.wilaya?.id ?? props.wilayaId ?? props.wilayas[0]?.id ?? null,
    post_code: commune?.post_code ?? '',
    latitude: commune?.latitude ?? '',
    longitude: commune?.longitude ?? '',
  }
  editing.value = !commune
  clear()
}

watch(() => props.commune, reset, { immediate: true })

function save(): Promise<void> {
  const fields = {
    name: form.value.name,
    arabic_name: form.value.arabic_name || null,
    wilaya_id: form.value.wilaya_id ?? undefined,
    post_code: form.value.post_code || null,
    latitude: numberOrNull(form.value.latitude),
    longitude: numberOrNull(form.value.longitude),
  }

  return run(
    () => (props.commune ? placesApi.updateCommune(props.commune.id, fields) : placesApi.createCommune(props.code, fields)),
    (commune) => emit('saved', commune),
  )
}
const remove = () => props.commune && run(() => placesApi.removeCommune(props.commune!.id), () => emit('deleted'))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="commune?.name ?? t('central.geography.addCommune')">
    <template v-if="commune?.wilaya" #badges><div><DlBadge size="sm">{{ commune.wilaya.name }}</DlBadge></div></template>

    <div class="flex flex-col gap-3">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <DlRecordSection
        v-model:editing="editing"
        :title="t('central.geography.details')"
        :can-edit="auth.can('geography.update')"
        :saving="busy"
        :save-label="commune ? undefined : t('central.geography.addCommune')"
        @save="save"
        @cancel="commune ? reset() : (open = false)"
      >
        <template v-if="commune">
          {{ commune.name }}<template v-if="commune.arabic_name"> · {{ commune.arabic_name }}</template><br>
          {{ t('central.geography.wilaya') }}: {{ commune.wilaya?.name ?? '—' }}<br>
          {{ t('central.geography.postCode') }}: {{ commune.post_code ?? '—' }}<br>
          {{ t('central.geography.position') }}: {{ commune.latitude !== null ? `${commune.latitude}, ${commune.longitude}` : '—' }}
        </template>
        <template #edit>
          <DlCombobox v-model="form.wilaya_id" :label="t('central.geography.wilaya')" :options="wilayaOptions" :error="errors.wilaya_id" />
          <DlInput v-model="form.name" :label="t('central.geography.name')" :error="errors.name" />
          <DlInput v-model="form.arabic_name" :label="t('central.geography.arabicName')" dir="rtl" :error="errors.arabic_name" />
          <DlInput v-model="form.post_code" :label="t('central.geography.postCode')" :error="errors.post_code" />
          <div class="grid grid-cols-2 gap-2.5">
            <DlInput v-model="form.latitude" :label="t('central.geography.latitude')" type="number" :error="errors.latitude" />
            <DlInput v-model="form.longitude" :label="t('central.geography.longitude')" type="number" :error="errors.longitude" />
          </div>
        </template>
      </DlRecordSection>

      <DeleteSection v-if="commune && auth.can('geography.update')" :hint="t('central.geography.communeDelete')" :blocked="false" :busy="busy" :reset-key="commune.id" @confirm="remove" />
      <p class="text-xs text-dl-muted">{{ t('central.geography.copyHint') }}</p>
    </div>
  </DlRecordPanel>
</template>

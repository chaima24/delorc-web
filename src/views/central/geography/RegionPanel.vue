<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { placesApi, type Region } from '@/api/central/geography'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useAuthStore } from '@/stores/auth'
import DeleteSection from './DeleteSection.vue'
import { usePanelAction } from './usePanelAction'

/** A region, or the form to add one when `region` is null. */
const props = defineProps<{ code: string; region: Region | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [region: Region]; deleted: []; seeWilayas: [region: Region] }>()

const { t, n } = useI18n()
const auth = useAuthStore()
const { errors, error, busy, run, clear } = usePanelAction()
const name = ref('')
const arabicName = ref('')
const editing = ref(false)

watch(() => props.region, () => {
  name.value = props.region?.name ?? ''
  arabicName.value = props.region?.arabic_name ?? ''
  editing.value = false
  clear()
}, { immediate: true })

const save = () => run(
  () => {
    const fields = { name: name.value, arabic_name: arabicName.value || null }

    return props.region ? placesApi.updateRegion(props.region.id, fields) : placesApi.createRegion(props.code, fields)
  },
  (region) => emit('saved', region),
)
const remove = () => props.region && run(() => placesApi.removeRegion(props.region!.id), () => emit('deleted'))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="region?.name ?? t('central.geography.addRegion')">
    <div class="flex flex-col gap-3">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <form v-if="!region" class="flex flex-col gap-3.5" @submit.prevent="save">
        <DlInput v-model="name" :label="t('central.geography.name')" :error="errors.name" />
        <DlInput v-model="arabicName" :label="t('central.geography.arabicName')" dir="rtl" :error="errors.arabic_name" />
        <div class="flex gap-2">
          <DlButton type="submit" variant="primary" size="sm" :loading="busy">{{ t('central.geography.addRegion') }}</DlButton>
          <DlButton variant="outline" size="sm" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
        </div>
      </form>
      <template v-else>
        <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5"><b class="font-display text-2xl font-extrabold">{{ n(region.wilayas_count) }}</b><span class="text-xs text-dl-muted">{{ t('central.geography.wilayasCount') }}</span></div>
        <DlButton v-if="region.wilayas_count" variant="dark" size="sm" @click="emit('seeWilayas', region)">{{ t('central.geography.seeWilayas') }}</DlButton>
        <DlRecordSection v-model:editing="editing" :title="t('central.geography.details')" :can-edit="auth.can('geography.update')" :saving="busy" @save="save" @cancel="name = region.name; arabicName = region.arabic_name ?? ''; editing = false">
          {{ t('central.geography.name') }}: {{ region.name }}<template v-if="region.arabic_name"> · {{ region.arabic_name }}</template>
          <template #edit>
            <div class="flex flex-col gap-3">
              <DlInput v-model="name" :label="t('central.geography.name')" :error="errors.name" />
              <DlInput v-model="arabicName" :label="t('central.geography.arabicName')" dir="rtl" :error="errors.arabic_name" />
            </div>
          </template>
        </DlRecordSection>
        <DeleteSection
          v-if="auth.can('geography.update')"
          :hint="t(region.wilayas_count ? 'central.geography.regionBlocked' : 'central.geography.canDelete')"
          :blocked="region.wilayas_count > 0"
          :busy="busy"
          :reset-key="region.id"
          @confirm="remove"
        />
      </template>
    </div>
  </DlRecordPanel>
</template>

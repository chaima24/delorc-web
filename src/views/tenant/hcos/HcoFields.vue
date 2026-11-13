<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { HCO_TYPES } from '@/api/tenant/hcos'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { useHcpLookups } from '@/views/tenant/hcps/useHcpLookups'
import type { HcoForm, HcoPart } from './hcoForm'

// The fields of one part of an organisation: info (type, name, part of, phone, OneKey) · place.
// `selfId`: the organisation being edited (it can't be its own parent).
const props = defineProps<{ part: HcoPart; errors?: Record<string, string>; selfId?: number }>()
const form = defineModel<HcoForm>('form', { required: true })
const { t } = useI18n()
const lookups = useHcpLookups()

const types = computed(() => HCO_TYPES.map(value => ({ value, label: t(`hcos.types.${value}`) })))
const type = computed({
  get: () => form.value.type as string,
  set: value => { form.value.type = value as HcoForm['type'] },
})
const parentOptions = computed(() => lookups.hcoOptions.value.filter(option => option.value !== props.selfId))
const parent = computed({
  get: () => form.value.parent_id,
  set: value => { form.value.parent_id = value == null ? null : Number(value) },
})

const wilaya = computed({
  get: () => form.value.wilaya_id,
  set: value => {
    const id = value == null ? null : Number(value)
    if (id === form.value.wilaya_id) return
    form.value.wilaya_id = id
    form.value.commune_id = null
  },
})
const commune = computed({
  get: () => form.value.commune_id,
  set: value => { form.value.commune_id = value == null ? null : Number(value) },
})
watch(() => (props.part === 'place' ? form.value.wilaya_id : null), id => lookups.loadCommunes(id), { immediate: true })
const communeOptions = computed(() => lookups.communeOptions(form.value.wilaya_id))
</script>

<template>
  <div v-if="part === 'info'" class="flex flex-col gap-3.5">
    <div class="flex flex-col gap-1.5">
      <span class="text-[13px] font-semibold">{{ t('hcos.fields.type') }}</span>
      <DlSegmented v-model="type" :label="t('hcos.fields.type')" :items="types" block />
    </div>
    <DlInput v-model="form.name" :label="t('hcos.fields.name')" :error="errors?.name" />
    <DlCombobox v-model="parent" :label="t('hcos.fields.parentOptional')" :options="parentOptions" :hint="t('hcos.fields.parentHint')" :error="errors?.parent_id" />
    <button v-if="form.parent_id" type="button" class="-mt-2 self-start text-xs font-semibold text-dl-muted hover:underline" @click="form.parent_id = null">{{ t('hcos.fields.noParent') }}</button>
    <DlInput v-model="form.phone" type="tel" :label="t('hcps.fields.phoneOptional')" :error="errors?.phone" />
    <DlInput v-model="form.one_key_id" :label="t('hcps.fields.oneKeyId')" :error="errors?.one_key_id" />
  </div>

  <div v-else class="flex flex-col gap-3.5">
    <DlCombobox v-model="wilaya" :label="t('hcps.fields.wilaya')" :options="lookups.wilayaOptions.value" />
    <DlCombobox
      v-model="commune"
      :label="t('hcps.fields.commune')"
      :options="communeOptions"
      :disabled="!form.wilaya_id"
      :hint="form.wilaya_id ? undefined : t('hcps.fields.communeHint')"
      :error="errors?.commune_id"
    />
    <DlInput v-model="form.address" :label="t('hcps.fields.addressOptional')" :error="errors?.address" />
    <fieldset class="flex flex-col gap-1.5">
      <legend class="mb-1.5 text-[13px] font-semibold">{{ t('hcps.fields.gpsOptional') }}</legend>
      <div class="grid grid-cols-2 gap-2">
        <DlInput v-model="form.latitude" inputmode="decimal" :label="t('hcps.fields.latitude')" :placeholder="t('hcps.fields.latitude')" hide-label />
        <DlInput v-model="form.longitude" inputmode="decimal" :label="t('hcps.fields.longitude')" :placeholder="t('hcps.fields.longitude')" hide-label />
      </div>
      <span v-if="errors?.latitude || errors?.longitude" class="text-xs text-dl-rejected">{{ errors.latitude || errors.longitude }}</span>
    </fieldset>
  </div>
</template>

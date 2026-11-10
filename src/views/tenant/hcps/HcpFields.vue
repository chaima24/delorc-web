<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { HCP_TYPES, type HcpContactedBy, type HcpGender, type HcpStatus } from '@/api/tenant/hcps'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { isPerson, type HcpForm, type HcpPart } from './hcpForm'
import { useHcpLookups } from './useHcpLookups'

// The fields of one part of a professional: identity · contact · place · external IDs.
// `full` adds status and "verified" to identity (editing an existing record).
const props = defineProps<{
  part: HcpPart
  errors?: Record<string, string>
  full?: boolean
}>()
const form = defineModel<HcpForm>('form', { required: true })
const { t } = useI18n()
const lookups = useHcpLookups()

const genders = computed(() => (['male', 'female'] as HcpGender[]).map(value => ({ value, label: t(`hcps.genders.${value}`) })))
const contactWays = computed(() => (['phone', 'email', 'other'] as HcpContactedBy[]).map(value => ({ value, label: t(`hcps.contactedBy.${value}`) })))
const statuses = computed(() => (['active', 'inactive'] as HcpStatus[]).map(value => ({ value, label: t(`hcps.status.${value}`) })))

const gender = computed({
  get: () => form.value.gender ?? '',
  set: value => { form.value.gender = (value || null) as HcpGender | null },
})
const contactedBy = computed({
  get: () => form.value.contacted_by as string,
  set: value => { form.value.contacted_by = value as HcpContactedBy },
})
const status = computed({
  get: () => form.value.status as string,
  set: value => { form.value.status = value as HcpStatus },
})

// Place: the wilaya narrows the communes.
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
  <div v-if="part === 'identity'" class="flex flex-col gap-3.5">
    <fieldset class="flex flex-col gap-1.5">
      <legend class="mb-1.5 text-[13px] font-semibold">{{ t('hcps.fields.type') }}</legend>
      <div role="radiogroup" :aria-label="t('hcps.fields.type')" class="flex flex-wrap gap-1.5">
        <button
          v-for="type in HCP_TYPES"
          :key="type"
          type="button"
          role="radio"
          :aria-checked="form.type === type"
          class="h-9 rounded-[10px] px-3.5 text-[13px] font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
          :class="form.type === type ? 'bg-dl-ink text-dl-on-ink dark:bg-dl-fg dark:text-dl-mist' : 'bg-dl-line-soft text-dl-body hover:text-dl-fg'"
          @click="form.type = type"
        >
          {{ t(`hcps.types.${type}`) }}
        </button>
      </div>
    </fieldset>
    <DlInput v-model="form.name" :label="t('hcps.fields.name')" :hint="t(isPerson(form.type) ? 'hcps.fields.nameHintPerson' : 'hcps.fields.nameHintBusiness')" :error="errors?.name" />
    <div v-if="isPerson(form.type)" class="flex flex-col gap-1.5">
      <span class="text-[13px] font-semibold">{{ t('hcps.fields.gender') }}</span>
      <DlSegmented v-model="gender" :label="t('hcps.fields.gender')" :items="genders" block />
      <span v-if="errors?.gender" class="text-xs text-dl-rejected">{{ errors.gender }}</span>
    </div>
    <template v-if="full">
      <!-- A proposal's status changes only by approving or refusing it (part 5d). -->
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('hcps.fields.status') }}</span>
        <DlSegmented v-model="status" :label="t('hcps.fields.status')" :items="statuses" block />
      </div>
      <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-dl-line px-3.5 py-2.5 hover:bg-dl-mist">
        <input v-model="form.verified" type="checkbox" class="mt-0.5 h-[18px] w-[18px] shrink-0 accent-dl-ink">
        <span class="flex flex-col"><strong class="text-sm font-semibold">{{ t('hcps.fields.verified') }}</strong><span class="text-xs text-dl-muted">{{ t('hcps.fields.verifiedHint') }}</span></span>
      </label>
    </template>
  </div>

  <div v-else-if="part === 'contact'" class="flex flex-col gap-3.5">
    <DlInput v-model="form.phone" type="tel" :label="t('hcps.fields.phoneOptional')" :error="errors?.phone" />
    <DlInput v-model="form.email" type="email" :label="t('hcps.fields.emailOptional')" :placeholder="t('hcps.fields.emailPlaceholder')" :error="errors?.email" />
    <DlInput v-model="form.fax" type="tel" :label="t('hcps.fields.faxOptional')" :error="errors?.fax" />
    <div class="flex flex-col gap-1.5">
      <span class="text-[13px] font-semibold">{{ t('hcps.fields.contactedBy') }}</span>
      <DlSegmented v-model="contactedBy" :label="t('hcps.fields.contactedBy')" :items="contactWays" block />
    </div>
  </div>

  <div v-else-if="part === 'place'" class="flex flex-col gap-3.5">
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
      <span v-else class="text-xs text-dl-muted">{{ t('hcps.fields.gpsHint') }}</span>
    </fieldset>
  </div>

  <div v-else class="flex flex-col gap-3.5">
    <DlInput v-model="form.one_key_id" :label="t('hcps.fields.oneKeyId')" :error="errors?.one_key_id" />
    <DlInput v-model="form.wkp_id" :label="t('hcps.fields.wkpId')" :error="errors?.wkp_id" />
  </div>
</template>

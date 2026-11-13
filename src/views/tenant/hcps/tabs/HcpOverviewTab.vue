<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { updateHcp, type Hcp } from '@/api/tenant/hcps'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import HcpFields from '../HcpFields.vue'
import HcpWorkplacesSection from '../HcpWorkplacesSection.vue'
import { checkPart, isPerson, toForm, toPayload, useHcpText, type HcpPart } from '../hcpForm'

// Overview: the record on the left (Identity · Contact · Works at, each with its own Edit),
// place with a map and the external IDs on the right.
const props = defineProps<{ hcp: Hcp }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const text = useHcpText()

const editing = reactive<Record<HcpPart, boolean>>({ identity: false, contact: false, place: false, ids: false })
const form = ref(toForm())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(() => props.hcp, value => {
  form.value = toForm(value)
  errors.value = {}
}, { immediate: true })

async function save(part: HcpPart) {
  errors.value = checkPart(form.value, part, { required: t('users.add.required'), coordinates: t('hcps.fields.gpsInvalid') })
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    await updateHcp(props.hcp.id, toPayload(form.value, [part]))
    toast.success(t('studio.list.toast.saved'))
    editing[part] = false
    emit('changed')
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
function cancel(part: HcpPart) {
  editing[part] = false
  form.value = toForm(props.hcp)
  errors.value = {}
}

const userName = (user?: Hcp['added_by']) => user?.full_name ?? null
const identity = computed(() => [
  { label: t('hcps.fields.type'), value: text.type(props.hcp.type) },
  { label: t('hcps.fields.name'), value: props.hcp.name },
  ...(isPerson(props.hcp.type) ? [{ label: t('hcps.fields.gender'), value: props.hcp.gender ? t(`hcps.genders.${props.hcp.gender}`) : '—' }] : []),
  { label: t('hcps.fields.status'), value: t(`hcps.status.${props.hcp.status ?? 'active'}`) },
  { label: t('hcps.fields.verified'), value: t(props.hcp.verified ? 'hcps.read.verifiedYes' : 'hcps.read.verifiedNo') },
])
const contact = computed(() => [
  { label: t('hcps.fields.phone'), value: props.hcp.phone || '—' },
  { label: t('hcps.fields.email'), value: props.hcp.email || '—' },
  { label: t('hcps.fields.fax'), value: props.hcp.fax || '—' },
  { label: t('hcps.fields.prefers'), value: props.hcp.contacted_by ? t(`hcps.contactedBy.${props.hcp.contacted_by}`) : '—' },
])
const hasGps = computed(() => props.hcp.latitude != null && props.hcp.longitude != null)
const gps = computed(() => (hasGps.value ? `${props.hcp.latitude}, ${props.hcp.longitude}` : null))
// OpenStreetMap's embed: no key, no library.
const mapUrl = computed(() => {
  if (!hasGps.value) return null
  const lat = Number(props.hcp.latitude)
  const lng = Number(props.hcp.longitude)
  const d = 0.004
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`
})
const place = computed(() => [
  { label: t('hcps.fields.address'), value: props.hcp.address || '—' },
  { label: t('hcps.fields.commune'), value: text.place(props.hcp) },
  { label: t('hcps.read.locatedBy'), value: userName(props.hcp.located_by) ?? '—' },
])
const ids = computed(() => [
  { label: t('hcps.fields.code'), value: text.code(props.hcp) },
  { label: t('hcps.fields.oneKeyId'), value: props.hcp.one_key_id || '—' },
  { label: t('hcps.fields.wkpId'), value: props.hcp.wkp_id || '—' },
])
</script>

<template>
  <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
    <div class="flex min-w-0 flex-col gap-4">
      <DlRecordSection
        v-model:editing="editing.identity"
        :title="t('hcps.read.identity')"
        icon="tabler-user"
        :can-edit="canUpdate('hcps')"
        :saving="saving"
        class="bg-dl-paper"
        @save="save('identity')"
        @cancel="cancel('identity')"
      >
        <dl class="divide-y divide-dl-line-soft">
          <div v-for="row in identity" :key="row.label" class="grid grid-cols-[110px_1fr] gap-3 py-2.5 first:pt-1 last:pb-0 md:grid-cols-[150px_1fr]">
            <dt class="text-dl-muted">{{ row.label }}</dt><dd class="text-dl-fg">{{ row.value }}</dd>
          </div>
        </dl>
        <template #edit><HcpFields v-model:form="form" part="identity" :errors="errors" full /></template>
      </DlRecordSection>

      <DlRecordSection
        v-model:editing="editing.contact"
        :title="t('hcps.read.contact')"
        icon="tabler-phone"
        :can-edit="canUpdate('hcps')"
        :saving="saving"
        class="bg-dl-paper"
        @save="save('contact')"
        @cancel="cancel('contact')"
      >
        <dl class="divide-y divide-dl-line-soft">
          <div v-for="row in contact" :key="row.label" class="grid grid-cols-[110px_1fr] gap-3 py-2.5 first:pt-1 last:pb-0 md:grid-cols-[150px_1fr]">
            <dt class="text-dl-muted">{{ row.label }}</dt><dd class="min-w-0 break-words text-dl-fg">{{ row.value }}</dd>
          </div>
        </dl>
        <template #edit><HcpFields v-model:form="form" part="contact" :errors="errors" /></template>
      </DlRecordSection>

      <HcpWorkplacesSection :hcp="hcp" @changed="emit('changed')" />
    </div>

    <div class="flex min-w-0 flex-col gap-4">
      <DlRecordSection
        v-model:editing="editing.place"
        :title="t('hcps.read.place')"
        icon="tabler-map-pin"
        :can-edit="canUpdate('hcps')"
        :saving="saving"
        class="bg-dl-paper"
        @save="save('place')"
        @cancel="cancel('place')"
      >
        <iframe
          v-if="mapUrl"
          :src="mapUrl"
          :title="t('hcps.read.map', { name: hcp.name })"
          loading="lazy"
          class="mb-2 mt-1 h-40 w-full rounded-2xl border-0 bg-dl-mist"
        />
        <p v-else class="mb-2 mt-1 flex h-24 items-center justify-center rounded-2xl bg-dl-mist text-center text-xs text-dl-muted">{{ t('hcps.read.noGps') }}</p>
        <dl class="divide-y divide-dl-line-soft">
          <div v-for="row in place" :key="row.label" class="grid grid-cols-[110px_1fr] gap-3 py-2.5 last:pb-0">
            <dt class="text-dl-muted">{{ row.label }}</dt><dd class="text-dl-fg">{{ row.value }}</dd>
          </div>
          <div class="grid grid-cols-[110px_1fr] gap-3 py-2.5 last:pb-0">
            <dt class="text-dl-muted">{{ t('hcps.fields.gps') }}</dt>
            <dd><a v-if="gps" :href="`https://www.google.com/maps?q=${gps}`" target="_blank" rel="noopener" class="text-dl-cobalt">{{ gps }} · {{ t('hcps.read.openMap') }} ↗</a><span v-else class="text-dl-fg">—</span></dd>
          </div>
        </dl>
        <template #edit><HcpFields v-model:form="form" part="place" :errors="errors" /></template>
      </DlRecordSection>

      <DlRecordSection
        v-model:editing="editing.ids"
        :title="t('hcps.read.ids')"
        icon="tabler-hash"
        :can-edit="canUpdate('hcps')"
        :saving="saving"
        class="bg-dl-paper"
        @save="save('ids')"
        @cancel="cancel('ids')"
      >
        <dl class="divide-y divide-dl-line-soft">
          <div v-for="row in ids" :key="row.label" class="grid grid-cols-[110px_1fr] gap-3 py-2.5 first:pt-1 last:pb-0">
            <dt class="text-dl-muted">{{ row.label }}</dt><dd class="break-all text-dl-fg">{{ row.value }}</dd>
          </div>
        </dl>
        <template #edit><HcpFields v-model:form="form" part="ids" :errors="errors" /></template>
      </DlRecordSection>
    </div>
  </div>
</template>

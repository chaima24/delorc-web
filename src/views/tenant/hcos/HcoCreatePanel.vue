<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createHco, fetchHco, type Hco } from '@/api/tenant/hcos'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSteps from '@/components/DlSteps.vue'
import { useToast } from '@/composables/useToast'
import { useHcpLookups } from '@/views/tenant/hcps/useHcpLookups'
import HcoFields from './HcoFields.vue'
import { checkPart, toForm, toPayload } from './hcoForm'

// "Add an organisation" in 2 steps: what (type, name, part of, phone, OneKey) · where.
// `parentId` pre-fills "Part of" (adding a department from an organisation's panel).
// Mockup: docs/design/customers-mockups/Organisations.html (frames 3–4)
const props = defineProps<{ parentId?: number | null }>()
const emit = defineEmits<{ created: [hco: Hco] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const lookups = useHcpLookups()

const form = ref(toForm())
const step = ref(0)
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const messages = computed(() => ({ required: t('users.add.required'), coordinates: t('hcps.fields.gpsInvalid') }))
const steps = computed(() => [t('hcos.add.steps.what'), t('hcos.add.steps.where')])

watch(open, value => {
  if (!value) return
  form.value = { ...toForm(), parent_id: props.parentId ?? null }
  step.value = 0
  errors.value = {}
}, { immediate: true })

// A department starts with its organisation's place.
let filledFrom: number | null = null
async function next() {
  errors.value = checkPart(form.value, 'info', messages.value)
  if (Object.keys(errors.value).length) return
  const parentId = form.value.parent_id
  if (parentId && parentId !== filledFrom && !form.value.commune_id) {
    try {
      const parent = await fetchHco(parentId)
      const place = toForm(parent)
      Object.assign(form.value, { wilaya_id: place.wilaya_id, commune_id: place.commune_id, address: place.address, latitude: place.latitude, longitude: place.longitude })
      filledFrom = parentId
    }
    catch {
      // Filled by hand then.
    }
  }
  step.value = 1
}

async function save() {
  errors.value = checkPart(form.value, 'info', messages.value)
  if (Object.keys(errors.value).length) {
    step.value = 0
    return
  }
  errors.value = checkPart(form.value, 'place', messages.value)
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    const created = await createHco(toPayload(form.value))
    toast.success(t('hcos.add.done', { name: form.value.name.trim() }))
    lookups.reloadHcos()
    emit('created', created)
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) {
      toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
      return
    }
    if (['name', 'type', 'parent_id', 'phone', 'one_key_id'].some(key => errors.value[key])) step.value = 0
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('hcos.add.title')" :description="t('teams.add.step', { n: step + 1, total: 2, name: steps[step] })">
    <form id="hco-create" class="flex flex-col gap-4" @submit.prevent="step === 0 ? next() : save()">
      <DlSteps :steps="steps" :current="step" />
      <HcoFields v-if="step === 0" v-model:form="form" part="info" :errors="errors" />
      <template v-else>
        <p v-if="form.parent_id" class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('hcos.add.placeHint') }}</p>
        <HcoFields v-model:form="form" part="place" :errors="errors" />
      </template>
    </form>
    <template #footer>
      <DlButton v-if="step === 0" variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton v-else variant="ghost" @click="step = 0">{{ t('users.add.back') }}</DlButton>
      <DlButton v-if="step === 0" type="submit" form="hco-create" variant="dark" class="ms-auto">{{ t('users.add.next') }}</DlButton>
      <DlButton v-else type="submit" form="hco-create" variant="primary" class="ms-auto" :loading="saving">{{ t('hcos.add.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

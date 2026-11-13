<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldErrors } from '@/api/errors'
import { updateTerritory, type Territory } from '@/api/tenant/territories'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useTerritories } from './useTerritoryLookups'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import TerritoryDetailsFields, { type TerritoryDetailsForm } from './TerritoryDetailsFields.vue'
import { useTerritoryText } from './territoryText'

// "Details" section (panel and full page): name, part of, sector, description, created by.
const props = defineProps<{ territory: Territory }>()
const emit = defineEmits<{ changed: []; open: [id: number] }>()
const { t } = useI18n()
const toast = useToast()
const text = useTerritoryText()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const shared = useTerritories()

const editing = ref(false)
const form = ref<TerritoryDetailsForm>({ name: '', parent_id: null, sector: '', description: '' })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function reset() {
  form.value = { name: props.territory.name, parent_id: props.territory.parent_id, sector: props.territory.sector ?? '', description: props.territory.description ?? '' }
  errors.value = {}
}
watch(() => props.territory, () => {
  editing.value = false
  reset()
}, { immediate: true })

async function save() {
  errors.value = form.value.name.trim() ? {} : { name: t('users.add.required') }
  if (errors.value.name) return
  saving.value = true
  try {
    await updateTerritory(props.territory.id, { name: form.value.name.trim(), parent_id: form.value.parent_id, sector: form.value.sector.trim() || null, description: form.value.description.trim() || null })
    toast.success(t('studio.list.toast.saved'))
    editing.value = false
    if (shared.loaded.value) shared.refresh()
    emit('changed')
  }
  catch (error) {
    const found = fieldErrors(error)
    if (Object.keys(found).length) errors.value = found
    else toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
function cancel() {
  editing.value = false
  reset()
}
</script>

<template>
  <DlRecordSection v-model:editing="editing" :title="t('territories.details')" :can-edit="canUpdate('territories')" :saving="saving" @save="save" @cancel="cancel">
    <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5">
      <dt class="text-dl-muted">{{ t('territories.fields.name') }}</dt><dd>{{ territory.name }}</dd>
      <dt class="text-dl-muted">{{ t('territories.fields.parent') }}</dt>
      <dd><button v-if="territory.parent" type="button" class="text-dl-cobalt hover:underline" @click="emit('open', territory.parent.id)">{{ territory.parent.name }}</button><span v-else>—</span></dd>
      <dt class="text-dl-muted">{{ t('territories.fields.sector') }}</dt><dd>{{ territory.sector || '—' }}</dd>
      <dt class="text-dl-muted">{{ t('territories.fields.description') }}</dt><dd class="whitespace-pre-line">{{ territory.description || '—' }}</dd>
      <dt class="text-dl-muted">{{ t('territories.fields.createdBy') }}</dt><dd>{{ territory.created_by ? `${territory.created_by.full_name} · ` : '' }}{{ text.date(territory.created_at) }}</dd>
    </dl>
    <template #edit><TerritoryDetailsFields v-model:form="form" :errors="errors" :self-id="territory.id" /></template>
  </DlRecordSection>
</template>

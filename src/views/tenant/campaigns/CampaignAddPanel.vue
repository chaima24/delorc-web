<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createCampaign, type Campaign } from '@/api/tenant/campaigns'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import CoachingRolePicks from '@/views/tenant/coaching/CoachingRolePicks.vue'
import { useCampaignLookups } from './useCampaignLookups'

// "Ajouter une campagne": name, dates, teams, objective, comment. The code comes from the API; the grid is filled on
// the campaign's page. Mockup frame 2.
const emit = defineEmits<{ created: [campaign: Campaign] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const { teams } = useCampaignLookups()

const empty = () => ({ name: '', start_date: '', end_date: '', team_ids: [] as number[], objective: '', comment: '' })
const form = ref(empty())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  form.value = empty()
  errors.value = {}
}, { immediate: true })

async function save() {
  errors.value = {}
  saving.value = true
  try {
    const created = await createCampaign({ ...form.value, comment: form.value.comment.trim() || null })
    toast.success(t('campaigns.add.done', { code: created.code }))
    emit('created', created)
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('campaigns.add.title')" :description="t('campaigns.add.description')">
    <form id="campaign-add" class="flex flex-col gap-4" @submit.prevent="save">
      <DlInput v-model="form.name" :label="t('campaigns.fields.name')" :error="errors.name" />
      <div class="grid grid-cols-2 gap-3">
        <DlInput v-model="form.start_date" type="date" :label="t('campaigns.fields.from')" :error="errors.start_date" />
        <DlInput v-model="form.end_date" type="date" :label="t('campaigns.fields.to')" :error="errors.end_date" />
      </div>
      <CoachingRolePicks v-model="form.team_ids" :label="t('campaigns.fields.teams')" :add-label="t('campaigns.fields.addTeam')" :options="teams" :error="errors.team_ids" />
      <DlInput v-model="form.objective" :label="t('campaigns.fields.objective')" :error="errors.objective" />
      <DlTextarea v-model="form.comment" :label="t('campaigns.fields.comment')" :rows="3" :error="errors.comment" />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="campaign-add" variant="primary" class="ms-auto" :loading="saving">{{ t('campaigns.add.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

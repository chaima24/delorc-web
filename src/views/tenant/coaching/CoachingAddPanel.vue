<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createCoaching, type Coaching } from '@/api/tenant/coaching'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useToast } from '@/composables/useToast'
import CoachingRolePicks from './CoachingRolePicks.vue'
import CoachingSectionPicker from './CoachingSectionPicker.vue'
import { useCoachingLookups } from './useCoachingLookups'

// "Ajouter un programme": name, dates, coach roles, coached roles and sections. Open questions are added on its page.
// Mockup frame 4.
const emit = defineEmits<{ created: [coaching: Coaching] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const { roleOptions, families } = useCoachingLookups()

const year = new Date().getFullYear() + 1
const form = ref({ name: '', start_date: '', end_date: '', coach_role_ids: [] as number[], coached_role_ids: [] as number[], category_ids: [] as number[] })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  form.value = { name: '', start_date: `${year}-01-01`, end_date: `${year}-12-31`, coach_role_ids: [], coached_role_ids: [], category_ids: [] }
  errors.value = {}
}, { immediate: true })

async function save() {
  errors.value = {}
  saving.value = true
  try {
    const created = await createCoaching(form.value)
    toast.success(t('coaching.add.done'))
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
  <DlRecordPanel v-model:open="open" :title="t('coaching.add.title')" :description="t('coaching.add.description')">
    <form id="coaching-add" class="flex flex-col gap-4" @submit.prevent="save">
      <DlInput v-model="form.name" :label="t('coaching.fields.name')" :error="errors.name" />
      <div class="grid grid-cols-2 gap-3">
        <DlInput v-model="form.start_date" type="date" :label="t('coaching.fields.from')" :error="errors.start_date" />
        <DlInput v-model="form.end_date" type="date" :label="t('coaching.fields.to')" :error="errors.end_date" />
      </div>
      <CoachingRolePicks v-model="form.coach_role_ids" :label="t('coaching.fields.coaches')" :options="roleOptions" :error="errors.coach_role_ids" />
      <CoachingRolePicks v-model="form.coached_role_ids" :label="t('coaching.fields.coached')" :options="roleOptions" :error="errors.coached_role_ids" />
      <CoachingSectionPicker v-model="form.category_ids" :families="families" :error="errors.category_ids || errors['category_ids.0']" />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="coaching-add" variant="primary" class="ms-auto" :loading="saving">{{ t('coaching.add.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

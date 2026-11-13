<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchCoachingPeople, planCoachingSession, resolveCoaching, type CoachingPerson, type CoachingResolved, type CoachingSessionPage } from '@/api/tenant/coaching'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useSessionText } from './coachingDisplay'

// "Planifier une séance": the person (the coach's team only) and the day. The program is found from the two roles;
// the objective starts from the last accepted session's next objective. Mockup frame 2.
const emit = defineEmits<{ created: [session: CoachingSessionPage] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const text = useSessionText()

const people = ref<CoachingPerson[]>([])
onMountedAndFocus(async () => { people.value = await fetchCoachingPeople() })
const peopleOptions = computed(() => people.value.map(person => ({
  value: person.id, label: person.full_name, hint: [roleLabel(person.role), person.team].filter(Boolean).join(' · '),
})))

const today = new Date().toISOString().slice(0, 10)
const personId = ref<number | string | null>(null)
const date = ref<string | number | null>(today)
const objective = ref('')
const resolved = ref<CoachingResolved | null>(null)
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  personId.value = null
  date.value = today
  objective.value = ''
  resolved.value = null
  errors.value = {}
}, { immediate: true })

// The program and the starting objective follow the person and the day.
watch([personId, date], async () => {
  resolved.value = null
  errors.value = {}
  if (!personId.value || !date.value) return
  try {
    resolved.value = await resolveCoaching(Number(personId.value), String(date.value))
    if (!objective.value && resolved.value.objective) objective.value = resolved.value.objective
  }
  catch (error) {
    errors.value = fieldErrors(error)
  }
})

async function save() {
  errors.value = {}
  if (!personId.value) {
    errors.value = { medical_rep_id: t('users.add.required') }
    return
  }
  saving.value = true
  try {
    const created = await planCoachingSession({ medical_rep_id: Number(personId.value), date: String(date.value), objective: objective.value || null })
    toast.success(t('coaching.sessions.plan.done'))
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
  <DlRecordPanel v-model:open="open" :title="t('coaching.sessions.plan.title')" :description="t('coaching.sessions.plan.description')">
    <form id="coaching-plan" class="flex flex-col gap-4" @submit.prevent="save">
      <DlCombobox v-model="personId" :label="t('coaching.sessions.fields.person')" :options="peopleOptions" :error="errors.medical_rep_id" />
      <DlInput v-model="date" type="date" :min="today" :label="t('coaching.sessions.fields.day')" :error="errors.date" />
      <p v-if="resolved" class="rounded-xl bg-dl-signal-soft px-3 py-2 text-xs text-dl-fg">
        {{ t('coaching.sessions.plan.program', { name: resolved.coaching.name, sections: resolved.coaching.sections_count, questions: resolved.coaching.questions_count, open: resolved.coaching.open_questions_count }) }}
      </p>
      <DlTextarea
        v-model="objective"
        :label="t('coaching.sessions.fields.objective')"
        :rows="3"
        :hint="resolved?.objective_from ? t('coaching.sessions.plan.objectiveFrom', { date: text.day(resolved.objective_from) }) : undefined"
        :error="errors.objective"
      />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="coaching-plan" variant="primary" class="ms-auto" :loading="saving" :disabled="!resolved">{{ t('coaching.sessions.plan.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

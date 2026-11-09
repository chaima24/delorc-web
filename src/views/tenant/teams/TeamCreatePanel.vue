<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createTeam, type Team } from '@/api/tenant/teams'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSteps from '@/components/DlSteps.vue'
import { useToast } from '@/composables/useToast'
import { today } from '@/views/tenant/users/userDisplay'
import TeamPeoplePicker from './TeamPeoplePicker.vue'
import TeamTargetsFields from './TeamTargetsFields.vue'

// "Add a team" in 2 steps: the team (name, specialities, brands) · members (optional).
const emit = defineEmits<{ created: [team: Team] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const blank = () => ({ name: '', description: '', specialities: [] as number[], brands: [] as number[], users: [] as number[], start_date: today() })
const form = reactive(blank())
const step = ref(0)
const errors = ref<Record<string, string>>({})
const saving = ref(false)

watch(open, value => {
  if (!value) return
  Object.assign(form, blank())
  step.value = 0
  errors.value = {}
})

const steps = computed(() => [t('teams.add.steps.team'), t('teams.add.steps.members')])

function checkTeam(): boolean {
  const found: Record<string, string> = {}
  if (!form.name.trim()) found.name = t('users.add.required')
  if (!form.specialities.length) found.specialities = t('teams.fields.specialitiesRequired')
  errors.value = found
  return !Object.keys(found).length
}
function next() {
  if (checkTeam()) step.value = 1
}

async function save() {
  if (!checkTeam()) {
    step.value = 0
    return
  }
  saving.value = true
  errors.value = {}
  try {
    const team = await createTeam({
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: true,
      specialities: form.specialities,
      brands: form.brands,
      ...(form.users.length ? { users: form.users, start_date: form.start_date } : {}),
    })
    toast.success(t('teams.add.done', { name: form.name.trim() }))
    emit('created', team)
  }
  catch (error) {
    const found = fieldErrors(error)
    if (!Object.keys(found).length) {
      toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
      return
    }
    errors.value = Object.fromEntries(Object.entries(found).map(([key, message]) => [key.split('.')[0]!, message]))
    if (['name', 'description', 'specialities', 'brands'].some(key => errors.value[key])) step.value = 0
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('teams.add.title')" :description="t('teams.add.step', { n: step + 1, total: 2, name: steps[step] })">
    <form id="team-create" class="flex flex-col gap-4" @submit.prevent="step === 0 ? next() : save()">
      <DlSteps :steps="steps" :current="step" />

      <template v-if="step === 0">
        <DlInput v-model="form.name" :label="t('teams.fields.name')" :error="errors.name" />
        <DlInput v-model="form.description" :label="t('teams.fields.description')" :placeholder="t('teams.fields.descriptionPlaceholder')" :error="errors.description" />
        <TeamTargetsFields v-model:specialities="form.specialities" v-model:brands="form.brands" :errors="errors" />
      </template>

      <template v-else>
        <TeamPeoplePicker v-model="form.users" :error="errors.users" />
        <DlInput v-if="form.users.length" v-model="form.start_date" type="date" :label="t('teams.members.from')" :error="errors.start_date" />
        <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('teams.add.membersLater') }}</p>
      </template>
    </form>

    <template #footer>
      <DlButton v-if="step === 0" variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton v-else variant="ghost" @click="step = 0">{{ t('users.add.back') }}</DlButton>
      <DlButton v-if="step === 0" type="submit" form="team-create" variant="dark" class="ms-auto">{{ t('users.add.next') }}</DlButton>
      <DlButton v-else type="submit" form="team-create" variant="primary" class="ms-auto" :loading="saving">{{ t('teams.add.save', { name: form.name.trim() }) }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchAllTeams } from '@/api/tenant/teams'
import { errorMessage, fieldErrors } from '@/api/errors'
import { addRespondents, fetchFieldPeople, previewRespondents, type RespondentPreview, type Survey } from '@/api/tenant/surveys'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlSheet from '@/components/DlSheet.vue'
import { useToast } from '@/composables/useToast'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import { useSurveyText } from './surveyDisplay'

// « Ajouter des personnes »: whole teams and / or people one by one (field roles only). Before adding, each person's
// cycle and the size of their list after the filters. Mockup: surveys-mockups/Respondents.html frame 2.
const props = defineProps<{ survey: Survey }>()
const emit = defineEmits<{ added: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const toast = useToast()
const text = useSurveyText()

const teams = ref<{ value: number; label: string }[]>([])
const teamIds = ref<number[]>([])
const people = ref<{ value: number; label: string; description?: string }[]>([])
const picked = ref<{ id: number; name: string }[]>([])
const person = ref<number | string | null>(null)
const searchText = ref('')
const preview = ref<{ items: RespondentPreview[]; people: number; list_count: number } | null>(null)
const saving = ref(false)
const errors = ref<Record<string, string>>({})

watch(open, async value => {
  if (!value) return
  teamIds.value = []
  picked.value = []
  preview.value = null
  teams.value = (await fetchAllTeams().catch(() => [])).map(row => ({ value: row.id, label: row.name }))
  people.value = await lookup('')
}, { immediate: true })

async function lookup(search: string) {
  return (await fetchFieldPeople(props.survey.id, search).catch(() => []))
    .map(row => ({ value: row.id, label: row.full_name, description: row.team?.name }))
}
watch(searchText, async value => { people.value = await lookup(value) })
watch(person, value => {
  const option = people.value.find(row => row.value === value)
  if (option && !picked.value.some(row => row.id === option.value)) picked.value.push({ id: option.value, name: option.label })
  person.value = null
})

const body = computed(() => ({ team_ids: teamIds.value, user_ids: picked.value.map(row => row.id) }))
const empty = computed(() => !teamIds.value.length && !picked.value.length)
watch(body, async value => {
  errors.value = {}
  preview.value = empty.value ? null : await previewRespondents(props.survey.id, value).catch(() => null)
}, { deep: true })

async function save() {
  saving.value = true
  errors.value = {}
  try {
    const answer = await addRespondents(props.survey.id, body.value)
    toast.success(t('surveys.respondents.addedDone', { count: answer.added ?? 0 }, answer.added ?? 0))
    emit('added')
    open.value = false
  }
  catch (error) {
    errors.value = fieldErrors(error)
    toast.error(Object.values(errors.value)[0] ?? errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlSheet v-model:open="open" size="lg" :title="t('surveys.respondents.add')" :description="t('surveys.respondents.addHint', { name: survey.name, target: text.target(survey.target_type) })">
    <div class="flex flex-col gap-4">
      <CheckList
        v-model="teamIds"
        :legend="t('surveys.respondents.teams')"
        :selected-label="t('surveys.respondents.teamsChosen', { count: teamIds.length }, teamIds.length)"
        :search-label="t('common.search.typeToSearch')"
        :items="teams"
        :empty-text="t('surveys.respondents.noTeams')"
      />
      <div class="flex flex-col gap-2">
        <DlCombobox v-model="person" v-model:search="searchText" :label="t('surveys.respondents.onePerson')" :placeholder="t('surveys.respondents.onePersonHint')" :options="people" />
        <div v-if="picked.length" class="flex flex-wrap gap-1.5">
          <button v-for="row in picked" :key="row.id" type="button" class="rounded-full bg-dl-mist px-3 py-1 text-[13px] hover:bg-dl-line-soft" @click="picked = picked.filter(p => p.id !== row.id)">
            {{ row.name }} ✕
          </button>
        </div>
      </div>
      <p class="rounded-2xl bg-dl-mist px-4 py-3 text-[13px] text-dl-muted">{{ t('surveys.respondents.addNote') }}</p>

      <section v-if="preview" class="flex flex-col gap-1">
        <h3 class="text-sm font-semibold">{{ t('surveys.respondents.willAdd', { count: preview.people }, preview.people) }}</h3>
        <ul class="flex flex-col text-[13px]">
          <li v-for="row in preview.items" :key="row.user.id" class="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-dl-line-soft py-2 last:border-0" :class="row.already_in && 'text-dl-muted'">
            <strong class="w-44 font-semibold">{{ row.user.full_name }}</strong>
            <span class="min-w-0 flex-1" :class="!row.cycle && 'text-dl-pending'">
              {{ text.cycle(row.cycle) }}<template v-if="row.cycle"> · {{ t('surveys.respondents.inCycle', { count: n(row.cycle_count) }) }}</template>
            </span>
            <span>{{ row.already_in ? t('surveys.respondents.alreadyIn') : row.cycle ? t('surveys.respondents.listSize', { count: n(row.list_count) }) : t('surveys.respondents.emptyList') }}</span>
          </li>
        </ul>
      </section>
    </div>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton variant="primary" :loading="saving" :disabled="!preview?.people" @click="save">
        {{ preview?.people ? t('surveys.respondents.addButton', { people: preview.people, list: n(preview.list_count) }) : t('surveys.respondents.add') }}
      </DlButton>
    </template>
  </DlSheet>
</template>

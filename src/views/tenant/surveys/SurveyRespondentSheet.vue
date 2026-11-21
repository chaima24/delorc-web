<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  addRespondentHcps, fetchAvailableHcps, fetchRespondentHcps, previewRecopy, recopy, removeRespondent, removeRespondentHcp,
  setRespondentActive, type Respondent, type RespondentHcp, type Survey,
} from '@/api/tenant/surveys'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSheet from '@/components/DlSheet.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSurveyText } from './surveyDisplay'

// A person's list: search, « à faire » / « répondus », add a professional by hand (amber note outside their
// territory), remove one still to do, « Recopier depuis le cycle », pause or remove the person.
// Mockup: surveys-mockups/Respondents.html frames 4, 5, 6.
const props = defineProps<{ survey: Survey; respondent: Respondent; canEdit: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const { confirm } = useConfirm()
const text = useSurveyText()

const ALL = 'all'
const search = ref('')
const state = ref(ALL)
const page = ref(1)
const perPage = ref(15)
const rows = ref<RespondentHcp[]>([])
const total = ref(0)
const counts = ref({ all: 0, todo: 0, answered: 0 })
async function load() {
  const answer = await fetchRespondentHcps(props.survey.id, props.respondent.id, {
    page: page.value, per_page: perPage.value, 'filter[search]': search.value || undefined, 'filter[state]': state.value === ALL ? undefined : state.value,
  })
  rows.value = answer.items
  total.value = answer.total
  counts.value = answer.counts
}
watch([search, state], () => { page.value = 1; load() })
watch([page, perPage], load, { immediate: true })
const stateItems = computed(() => [
  { value: ALL, label: `${t('surveys.list.all')} · ${counts.value.all}` },
  { value: 'todo', label: `${t('surveys.respondents.todo')} · ${counts.value.todo}` },
  { value: 'answered', label: `${t('surveys.respondents.answered')} · ${counts.value.answered}` },
])
const closed = computed(() => props.survey.status === 'closed')
const editable = computed(() => props.canEdit && !closed.value)

async function changed() {
  await load()
  emit('changed')
}

// Add by hand.
const adding = ref(false)
const hcp = ref<number | string | null>(null)
const hcpSearch = ref('')
const options = ref<{ value: number; label: string; description?: string }[]>([])
async function lookup() {
  options.value = (await fetchAvailableHcps(props.survey.id, props.respondent.id, hcpSearch.value).catch(() => []))
    .map(row => ({ value: row.id, label: row.name, description: [t(`surveys.respondents.kind.${row.type}`), row.wilaya].filter(Boolean).join(' · ') }))
}
watch(hcpSearch, lookup)
watch(adding, value => { if (value) lookup() })
watch(hcp, async value => {
  if (!value) return
  try {
    await addRespondentHcps(props.survey.id, props.respondent.id, [Number(value)])
    toast.success(t('surveys.respondents.hcpAdded'))
    hcp.value = null
    await lookup()
    await changed()
  }
  catch (error) {
    toast.error(Object.values(fieldErrors(error))[0] ?? errorMessage(error) ?? t('studio.list.toast.failed'))
  }
})

async function removeHcp(row: RespondentHcp) {
  try {
    await removeRespondentHcp(props.survey.id, props.respondent.id, row.hcp.id)
    toast.success(t('studio.list.toast.deleted'))
    await changed()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

async function doRecopy() {
  const preview = await previewRecopy(props.survey.id, props.respondent.id).catch(() => null)
  if (!preview) return
  if (!preview.cycle) {
    toast.error(t('surveys.respondents.recopyNoCycle'))
    return
  }
  const ok = await confirm({
    title: t('surveys.respondents.recopyTitle', { name: props.respondent.user.full_name }),
    text: t('surveys.respondents.recopyText', {
      cycle: text.cycle(preview.cycle), count: preview.cycle_list_count, add: preview.to_add, kept: preview.kept, out: preview.not_in_cycle,
    }),
    confirmButtonText: t('surveys.respondents.recopyButton', { count: preview.to_add }, preview.to_add),
    icon: 'question',
  })
  if (!ok) return
  try {
    await recopy(props.survey.id, props.respondent.id)
    toast.success(t('surveys.respondents.recopied', { count: preview.to_add }, preview.to_add))
    await changed()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

const busy = ref(false)
async function togglePause() {
  busy.value = true
  try {
    await setRespondentActive(props.survey.id, props.respondent.id, !props.respondent.is_active)
    toast.success(t(props.respondent.is_active ? 'surveys.respondents.pausedDone' : 'surveys.respondents.resumed', { name: props.respondent.user.full_name }))
    emit('changed')
    open.value = false
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    busy.value = false
  }
}
async function removePerson() {
  const ok = await confirm({
    title: t('surveys.respondents.removeTitle', { name: props.respondent.user.full_name }),
    text: t('surveys.respondents.removeText'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await removeRespondent(props.survey.id, props.respondent.id)
    toast.success(t('studio.list.toast.deleted'))
    emit('changed')
    open.value = false
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <DlSheet
    v-model:open="open"
    size="lg"
    :title="t('surveys.respondents.sheetTitle', { name: respondent.user.full_name, count: n(counts.all) })"
    :description="`${text.cycle(respondent.cycle)} · ${t('surveys.respondents.sheetCounts', { answered: counts.answered, todo: counts.todo })}`"
  >
    <div class="flex flex-col gap-3">
      <p v-if="!respondent.is_active" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13px] text-dl-muted">{{ t('surveys.respondents.pausedBanner') }}</p>
      <div class="flex flex-wrap items-end gap-2">
        <div class="min-w-48 flex-1"><DlInput v-model="search" :label="t('surveys.respondents.searchHcp')" :placeholder="t('surveys.respondents.searchHcp')" icon="tabler-search" hide-label /></div>
        <DlSegmented v-model="state" :label="t('surveys.fields.status')" :items="stateItems" />
      </div>
      <div v-if="editable" class="flex flex-wrap gap-2">
        <DlButton size="sm" variant="outline" icon="tabler-plus" @click="adding = !adding">{{ t('surveys.respondents.addHcp') }}</DlButton>
        <DlButton size="sm" variant="outline" icon="tabler-refresh" @click="doRecopy">{{ t('surveys.respondents.recopy') }}</DlButton>
      </div>
      <DlCombobox v-if="editable && adding" v-model="hcp" v-model:search="hcpSearch" :label="t('surveys.respondents.addHcp')" :placeholder="t('surveys.respondents.addHcpHint')" :options="options" />

      <table class="w-full text-[13px]">
        <thead class="text-start text-xs text-dl-muted">
          <tr class="border-b border-dl-line">
            <th class="py-2 text-start font-semibold">{{ t('surveys.respondents.professional') }}</th>
            <th class="py-2 text-start font-semibold max-md:hidden">{{ t('surveys.respondents.speciality') }}</th>
            <th class="py-2 text-start font-semibold max-md:hidden">{{ t('surveys.respondents.segment') }}</th>
            <th class="py-2 text-start font-semibold max-md:hidden">{{ t('surveys.respondents.wilaya') }}</th>
            <th class="py-2 text-start font-semibold">{{ t('surveys.fields.status') }}</th>
            <th class="w-10" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.hcp.id" class="border-b border-dl-line-soft">
            <td class="py-2">
              <strong class="font-semibold">{{ row.hcp.name }}</strong>
              <DlBadge v-if="!row.in_territory" size="sm" tone="warning" class="ms-1.5">{{ t('surveys.respondents.outside') }}</DlBadge>
            </td>
            <td class="py-2 max-md:hidden">{{ row.speciality ?? '—' }}</td>
            <td class="py-2 max-md:hidden">{{ row.segment ?? '—' }}</td>
            <td class="py-2 max-md:hidden">{{ row.wilaya ?? '—' }}</td>
            <td class="py-2">
              <RouterLink v-if="row.answered_at && row.answered_visit_id && auth.can('visits.show')" :to="{ name: 'tenant-visit-detail', params: { id: row.answered_visit_id } }" class="no-underline">
                <DlBadge size="sm" tone="success">{{ t('surveys.respondents.answeredOn', { date: text.date(row.answered_at) }) }}</DlBadge>
              </RouterLink>
              <DlBadge v-else-if="row.answered_at" size="sm" tone="success">{{ t('surveys.respondents.answeredOn', { date: text.date(row.answered_at) }) }}</DlBadge>
              <DlBadge v-else size="sm">{{ t('surveys.respondents.todo') }}</DlBadge>
            </td>
            <td class="py-2 text-end">
              <DlIconButton v-if="editable && !row.answered_at" icon="tabler-x" variant="ghost" :size="30" :label="t('surveys.respondents.removeHcp', { name: row.hcp.name })" @click="removeHcp(row)" />
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6" class="py-6 text-center text-dl-muted">{{ t('surveys.respondents.listEmpty') }}</td></tr>
        </tbody>
      </table>
      <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      <p class="text-xs text-dl-muted">{{ t('surveys.respondents.listNote') }}</p>
    </div>
    <template v-if="editable" #footer>
      <DlButton variant="ghost" @click="removePerson">{{ t('surveys.respondents.remove') }}</DlButton>
      <DlButton variant="outline" class="ms-auto" :loading="busy" @click="togglePause">{{ respondent.is_active ? t('surveys.respondents.pause') : t('surveys.respondents.resume') }}</DlButton>
      <DlButton variant="dark" @click="open = false">{{ t('common.actions.close') }}</DlButton>
    </template>
  </DlSheet>
</template>

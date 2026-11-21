<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { fetchAllBrands } from '@/api/tenant/brands'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  closeSurvey, deleteQuestion, deleteSurvey, duplicateSurvey, fetchAllQuestionCategories, fetchSurvey, openSurvey, orderQuestions,
  SURVEY_TARGETS, updateSurvey,
  type QuestionCategory, type Survey, type SurveyHistoryLine, type SurveyPayload, type SurveyQuestion, type SurveyTarget,
} from '@/api/tenant/surveys'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDatePicker from '@/components/DlDatePicker.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTabs from '@/components/DlTabs.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import SurveyPreviewSheet from './SurveyPreviewSheet.vue'
import SurveyQuestionSheet from './SurveyQuestionSheet.vue'
import SurveyAnswersTab from './SurveyAnswersTab.vue'
import SurveyRespondentsTab from './SurveyRespondentsTab.vue'
import { STATUS_TONE, today, useSurveyText, weeks } from './surveyDisplay'

// A survey's page: its card (edited in place), its history, and its questions: titles holding questions, numbered
// Q1… by the API, moved by dragging while it is a draft. Open, close, duplicate, delete.
// Mockup: surveys-mockups/Surveys.html frames 3–9.
const props = defineProps<{ id: string }>()
const { t, n } = useI18n()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const { confirm } = useConfirm()
const text = useSurveyText()

const survey = ref<Survey | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    survey.value = await fetchSurvey(Number(props.id))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { survey.value = null; openErrors.value = []; load() }, { immediate: true })
const draft = computed(() => survey.value?.status === 'draft')
const canEdit = computed(() => !!survey.value?.can?.update)
const canEditQuestions = computed(() => draft.value && canEdit.value)

// Brands and categories, reloaded on open and when the tab comes back.
const brands = ref<{ value: number; label: string }[]>([])
const categories = ref<QuestionCategory[]>([])
onMountedAndFocus(async () => {
  brands.value = (await fetchAllBrands().catch(() => [])).map(brand => ({ value: brand.id, label: brand.name }))
  categories.value = await fetchAllQuestionCategories().catch(() => [])
})

// The survey's card. Once open, only its name, end date, objective and brands change.
const ONCE = 'once'
const PER_VISIT = 'perVisit'
const editing = ref(false)
const form = ref({ name: '', target_type: 'doctor' as string, mode: ONCE, start_date: '', end_date: '', objective: '', brand_ids: [] as number[] })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function edit(value: boolean) {
  const row = survey.value
  if (!row || !value) {
    editing.value = false
    return
  }
  form.value = {
    name: row.name, target_type: row.target_type, mode: row.is_per_visit ? PER_VISIT : ONCE, start_date: row.start_date, end_date: row.end_date,
    objective: row.objective_per_week == null ? '' : String(row.objective_per_week), brand_ids: (row.brands ?? []).map(brand => brand.id),
  }
  errors.value = {}
  editing.value = true
}
const targetItems = computed(() => SURVEY_TARGETS.map(target => ({ value: target, label: text.target(target) })))
const modeItems = computed(() => [{ value: ONCE, label: text.mode(false) }, { value: PER_VISIT, label: text.mode(true) }])
const weekCount = computed(() => weeks(form.value.start_date, form.value.end_date))
async function saveCard() {
  if (!survey.value) return
  const payload: SurveyPayload = {
    name: form.value.name,
    end_date: form.value.end_date,
    objective_per_week: form.value.objective === '' ? null : Number(form.value.objective),
    brand_ids: form.value.brand_ids,
  }
  if (draft.value) {
    Object.assign(payload, { target_type: form.value.target_type as SurveyTarget, is_per_visit: form.value.mode === PER_VISIT, start_date: form.value.start_date })
  }
  errors.value = {}
  saving.value = true
  try {
    survey.value = await updateSurvey(survey.value.id, payload)
    editing.value = false
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}

// Questions: the side panel for one, the preview, the drag.
const sheet = ref(false)
const sheetQuestion = ref<SurveyQuestion | null>(null)
const sheetTitle = ref(false)
function openSheet(question: SurveyQuestion | null, title = false) {
  sheetQuestion.value = question
  sheetTitle.value = title
  sheet.value = true
}
const previewing = ref(false)
const answerable = computed(() => (survey.value?.questions ?? []).filter(q => q.type !== 'title').length)
const titleCount = computed(() => (survey.value?.questions ?? []).filter(q => q.type === 'title').length)

async function removeQuestion(question: SurveyQuestion) {
  if (!survey.value) return
  const ok = await confirm({
    title: t('surveys.page.deleteQuestionTitle', { name: question.number ?? question.question_text }),
    text: t(question.type === 'title' ? 'surveys.page.deleteTitleText' : 'surveys.page.deleteQuestionText'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    survey.value = await deleteQuestion(survey.value.id, question.id)
    toast.success(t('studio.list.toast.deleted'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

/**
 * A drop on another row. Moving down puts the dragged row after the target, moving up before it. A question takes
 * the title of the row just before it (that title, or the title that row sits under); a title moves with its
 * questions and never lands inside another title.
 */
const dragged = ref<SurveyQuestion | null>(null)
async function drop(target: SurveyQuestion) {
  const moving = dragged.value
  dragged.value = null
  const all = survey.value?.questions ?? []
  if (!survey.value || !moving || moving.id === target.id) return
  const block = moving.type === 'title' ? all.filter(q => q.id === moving.id || q.parent_id === moving.id) : [moving]
  if (block.some(q => q.id === target.id)) return
  const down = all.indexOf(target) > all.indexOf(moving)
  const rest = all.filter(q => !block.includes(q))
  let at = rest.indexOf(target) + (down ? 1 : 0)
  let parent: number | null = null
  if (moving.type === 'title') {
    while (at < rest.length && rest[at]!.parent_id !== null) at++
  }
  else {
    const before = rest[at - 1]
    parent = before ? (before.type === 'title' ? before.id : before.parent_id) : null
  }
  const order = [...rest.slice(0, at), ...block, ...rest.slice(at)]
  const items = order.map(q => ({ id: q.id, parent_id: q.id === moving.id ? parent : q.parent_id }))
  try {
    survey.value = await orderQuestions(survey.value.id, items)
  }
  catch (error) {
    toast.error(fieldErrors(error).items ?? errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

// Moves.
const moving = ref(false)
const openErrors = ref<string[]>([])
async function open() {
  if (!survey.value) return
  const ok = await confirm({
    title: t('surveys.page.openTitle', { name: survey.value.name }),
    text: t('surveys.page.openText', { count: answerable.value, required: survey.value.required_count, period: text.period(survey.value.start_date, survey.value.end_date) }),
    confirmButtonText: t('surveys.page.open'),
    icon: 'question',
  })
  if (!ok) return
  moving.value = true
  openErrors.value = []
  try {
    survey.value = await openSurvey(survey.value.id)
    toast.success(t('surveys.page.opened'))
  }
  catch (error) {
    const reasons = (error as { response?: { data?: { errors?: { survey?: string[] } } } }).response?.data?.errors?.survey
    if (reasons?.length) openErrors.value = reasons
    else toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    moving.value = false
  }
}
async function close() {
  if (!survey.value) return
  const ok = await confirm({ title: t('surveys.page.closeTitle', { name: survey.value.name }), text: t('surveys.page.closeText'), confirmButtonText: t('surveys.page.close'), icon: 'warning' })
  if (!ok) return
  moving.value = true
  try {
    survey.value = await closeSurvey(survey.value.id)
    editing.value = false
    toast.success(t('surveys.page.closed'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    moving.value = false
  }
}
async function duplicate() {
  if (!survey.value) return
  moving.value = true
  try {
    const copy = await duplicateSurvey(survey.value.id)
    toast.success(t('surveys.page.duplicated'))
    router.push({ name: 'tenant-survey', params: { id: copy.id } })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    moving.value = false
  }
}
async function remove() {
  if (!survey.value) return
  const ok = await confirm({ title: t('surveys.page.deleteTitle', { name: survey.value.name }), text: t('surveys.page.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteSurvey(survey.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-surveys' })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

// Tabs: the questions, who answers (19b-1), the answers once the survey is open (19b-2). `?tab=respondents` or `?tab=answers` opens one.
const tab = ref(['respondents', 'answers'].includes(String(route.query.tab)) ? String(route.query.tab) : 'questions')
watch(tab, value => router.replace({ query: { ...route.query, tab: value === 'questions' ? undefined : value } }))
const tabs = computed(() => [
  { value: 'questions', label: t('surveys.page.tabQuestions', { count: answerable.value }) },
  { value: 'respondents', label: t('surveys.page.tabRespondents') },
  ...(survey.value?.status === 'draft' ? [] : [{ value: 'answers', label: t('surveys.page.tabAnswers') }]),
])

const STEPS = ['draft', 'open', 'closed'] as const
const reached = (step: (typeof STEPS)[number]) => STEPS.indexOf(survey.value!.status) >= STEPS.indexOf(step)

function historyLine(line: SurveyHistoryLine): string {
  const known = [
    'created', 'opened', 'closed', 'duplicated', 'question_added', 'question_updated', 'question_deleted', 'questions_reordered',
    'respondents_added', 'respondent_paused', 'respondent_resumed', 'respondent_removed', 'professionals_added', 'professionals_removed', 'list_recopied',
  ]
  if (known.includes(line.event)) return t(`surveys.history.${line.event}`, { text: line.text ?? '' })
  if (line.new && 'brands' in line.new) return t('surveys.history.brands')
  return t('surveys.history.changed')
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('surveys.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-surveys' }">{{ t('surveys.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!survey">
      <DlSkeleton class="h-20 rounded-2xl" />
      <DlSkeleton class="h-64 rounded-3xl" />
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
            <RouterLink :to="{ name: 'tenant-surveys' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('surveys.list.title') }}</RouterLink>
            <span aria-hidden="true">›</span><span class="truncate">{{ survey.name }}</span>
          </nav>
          <h1 class="flex flex-wrap items-center gap-3 font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">
            {{ survey.name }}
            <DlBadge size="sm" :tone="STATUS_TONE[survey.status]" dot>{{ text.status(survey.status) }}</DlBadge>
          </h1>
          <p v-if="survey.created_by" class="text-[13px] text-dl-muted">{{ t('surveys.read.by', { name: survey.created_by.full_name, date: text.date(survey.created_at) }) }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <DlButton v-if="survey.can?.duplicate" variant="outline" icon="tabler-copy" :loading="moving" @click="duplicate">{{ t('surveys.page.duplicate') }}</DlButton>
          <DlButton v-if="survey.can?.delete" variant="outline" icon="tabler-trash" @click="remove">{{ t('common.actions.delete') }}</DlButton>
          <DlButton v-if="survey.can?.open" variant="primary" icon="tabler-player-play" :loading="moving" @click="open">{{ t('surveys.page.open') }}</DlButton>
          <DlButton v-if="survey.can?.close" variant="dark" icon="tabler-lock" :loading="moving" @click="close">{{ t('surveys.page.close') }}</DlButton>
        </div>
      </div>

      <ol class="flex flex-wrap items-center gap-1.5 text-[13px]" :aria-label="t('surveys.fields.status')">
        <template v-for="(step, i) in STEPS" :key="step">
          <li><DlBadge size="sm" :tone="reached(step) ? 'success' : 'neutral'" :class="survey.status === step && 'ring-2 ring-dl-ink'">{{ text.status(step) }}</DlBadge></li>
          <li v-if="i < STEPS.length - 1" aria-hidden="true" class="text-dl-muted">→</li>
        </template>
      </ol>
      <DlAlert v-if="openErrors.length">
        <strong class="block">{{ t('surveys.page.openRefused') }}</strong>
        <span v-for="reason in openErrors" :key="reason" class="block">{{ reason }}</span>
      </DlAlert>
      <p v-if="survey.status === 'closed'" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13.5px] text-dl-muted">{{ t('surveys.page.closedBanner') }}</p>

      <DlTabs v-model="tab" :label="t('surveys.page.tabs')" :items="tabs">
        <template #questions>
          <div class="grid items-start gap-4 xl:grid-cols-[420px_1fr]">
            <div class="flex flex-col gap-4">
              <div class="rounded-3xl bg-dl-paper p-4 md:p-5">
                <DlRecordSection :editing="editing" :title="t('surveys.page.card')" icon="tabler-clipboard-list" :can-edit="canEdit" :saving="saving" @update:editing="edit" @save="saveCard" @cancel="edit(false)">
                  <dl class="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5">
                    <dt class="text-dl-muted">{{ t('surveys.fields.target') }}</dt>
                    <dd>{{ text.target(survey.target_type) }}<DlIcon v-if="!draft" icon="tabler-lock" :size="14" class="ms-1 inline text-dl-muted" /></dd>
                    <dt class="text-dl-muted">{{ t('surveys.fields.mode') }}</dt>
                    <dd>{{ text.mode(survey.is_per_visit) }}<DlIcon v-if="!draft" icon="tabler-lock" :size="14" class="ms-1 inline text-dl-muted" /></dd>
                    <dt class="text-dl-muted">{{ t('surveys.fields.period') }}</dt>
                    <dd>{{ text.period(survey.start_date, survey.end_date) }} · {{ t('surveys.fields.weeks', { count: survey.weeks_count }, survey.weeks_count) }}</dd>
                    <dt class="text-dl-muted">{{ t('surveys.fields.objective') }}</dt>
                    <dd>{{ survey.objective_per_week == null ? '—' : t('surveys.fields.objectiveValue', { count: n(survey.objective_per_week) }) }}</dd>
                    <dt class="text-dl-muted">{{ t('surveys.fields.brands') }}</dt>
                    <dd class="flex flex-wrap gap-1">
                      <DlBadge v-for="brand in survey.brands" :key="brand.id" size="sm">{{ brand.name }}</DlBadge>
                      <span v-if="!survey.brands?.length">—</span>
                    </dd>
                  </dl>
                  <template #edit>
                    <DlInput v-model="form.name" :label="t('surveys.fields.name')" :error="errors.name" />
                    <template v-if="draft">
                      <div class="flex flex-col gap-1.5">
                        <span class="text-[13px] font-semibold">{{ t('surveys.fields.target') }}</span>
                        <DlSegmented v-model="form.target_type" :label="t('surveys.fields.target')" :items="targetItems" block />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <span class="text-[13px] font-semibold">{{ t('surveys.fields.mode') }}</span>
                        <DlSegmented v-model="form.mode" :label="t('surveys.fields.mode')" :items="modeItems" block />
                      </div>
                    </template>
                    <div class="grid gap-3 sm:grid-cols-2">
                      <DlDatePicker v-if="draft" v-model="form.start_date" :label="t('surveys.fields.start')" :error="errors.start_date" />
                      <DlDatePicker v-model="form.end_date" :label="t('surveys.fields.end')" :min="draft ? form.start_date : today()" :error="errors.end_date" />
                    </div>
                    <p v-if="weekCount" class="text-xs text-dl-muted">{{ t('surveys.fields.weeks', { count: weekCount }, weekCount) }}</p>
                    <DlInput v-model="form.objective" type="number" :label="t('surveys.fields.objectiveOptional')" :hint="t('surveys.fields.objectiveHint')" :error="errors.objective_per_week" />
                    <CheckList
                      v-model="form.brand_ids"
                      :legend="t('surveys.fields.brands')"
                      :selected-label="t('surveys.fields.brandsChosen', { count: form.brand_ids.length }, form.brand_ids.length)"
                      :search-label="t('surveys.fields.brandsSearch')"
                      :items="brands"
                      :empty-text="t('surveys.fields.brandsEmpty')"
                    />
                  </template>
                </DlRecordSection>
              </div>

              <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
                <h2 class="text-[15px] font-semibold">{{ t('surveys.page.history') }}</h2>
                <ul class="flex flex-col gap-1.5 text-[13px]">
                  <li v-for="(line, i) in survey.history" :key="i" class="flex flex-wrap gap-x-2">
                    <span class="tabular-nums text-dl-muted">{{ text.date(line.at) }}</span>
                    <span v-if="line.by" class="font-semibold">{{ line.by }}</span>
                    <span>{{ historyLine(line) }}</span>
                  </li>
                </ul>
              </section>
            </div>

            <section class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
              <header class="flex flex-wrap items-center gap-2">
                <h2 class="text-[15px] font-semibold">{{ t('surveys.page.questions') }}</h2>
                <span class="text-[13px] text-dl-muted">· {{ t('surveys.page.questionsCount', { count: answerable, titles: titleCount }) }}</span>
                <span class="ms-auto flex flex-wrap gap-2">
                  <DlButton size="sm" variant="outline" icon="tabler-eye" @click="previewing = true">{{ t('surveys.page.preview') }}</DlButton>
                  <template v-if="canEditQuestions">
                    <DlButton size="sm" variant="outline" icon="tabler-heading" @click="openSheet(null, true)">{{ t('surveys.page.addTitle') }}</DlButton>
                    <DlButton size="sm" variant="dark" icon="tabler-plus" @click="openSheet(null)">{{ t('surveys.page.addQuestion') }}</DlButton>
                  </template>
                </span>
              </header>
              <p v-if="!draft" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13px] text-dl-muted">{{ t('surveys.page.frozen') }}</p>
              <p v-else-if="canEditQuestions && survey.questions?.length" class="text-xs text-dl-muted">{{ t('surveys.page.dragHint') }}</p>
              <p v-if="!survey.questions?.length" class="text-[13px] text-dl-muted">{{ t('surveys.page.noQuestions') }}</p>
              <ul class="flex flex-col gap-2">
                <li
                  v-for="q in survey.questions"
                  :key="q.id"
                  :draggable="canEditQuestions"
                  class="flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-sm"
                  :class="[
                    q.type === 'title' ? 'border-transparent bg-dl-mist font-bold' : 'border-dl-line-soft',
                    q.parent_id ? 'ms-8 max-md:ms-4' : '',
                    dragged?.id === q.id && 'opacity-50',
                  ]"
                  @dragstart="dragged = q"
                  @dragend="dragged = null"
                  @dragover.prevent
                  @drop.prevent="drop(q)"
                >
                  <DlIcon v-if="canEditQuestions" icon="tabler-grip-vertical" :size="16" class="shrink-0 cursor-grab text-dl-muted" aria-hidden="true" />
                  <span v-if="q.number" class="w-9 shrink-0 font-display font-extrabold">{{ q.number }}</span>
                  <span class="min-w-0 flex-1">
                    {{ q.question_text }}<span v-if="q.is_required" class="font-bold text-dl-rejected" :title="t('surveys.question.required')"> *</span>
                  </span>
                  <span class="flex shrink-0 items-center gap-2 max-md:hidden">
                    <DlBadge size="sm" :tone="q.type === 'title' ? 'neutral' : 'info'">{{ q.type === 'title' ? t('surveys.types.title.name') : text.type(q.type) }}</DlBadge>
                    <span v-if="q.type !== 'title'" class="w-28 truncate text-xs text-dl-muted">{{ q.category?.category ?? '—' }}</span>
                  </span>
                  <template v-if="canEditQuestions">
                    <DlIconButton icon="tabler-pencil" variant="ghost" :size="32" :label="t('surveys.page.editQuestion', { name: q.number ?? q.question_text })" @click="openSheet(q)" />
                    <DlIconButton icon="tabler-trash" variant="ghost" :size="32" :label="t('surveys.page.deleteQuestionTitle', { name: q.number ?? q.question_text })" @click="removeQuestion(q)" />
                  </template>
                </li>
              </ul>
            </section>
          </div>
        </template>
        <template #respondents>
          <SurveyRespondentsTab :survey="survey" @survey="value => (survey = value)" />
        </template>
        <template #answers>
          <SurveyAnswersTab :survey="survey" />
        </template>
      </DlTabs>

      <SurveyQuestionSheet v-if="sheet" v-model:open="sheet" :survey="survey" :question="sheetQuestion" :title="sheetTitle" :categories="categories" @saved="value => (survey = value)" />
      <SurveyPreviewSheet v-if="previewing" v-model:open="previewing" :survey="survey" />
    </template>
  </div>
</template>

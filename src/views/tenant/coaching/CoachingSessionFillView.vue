<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchAllBrands } from '@/api/tenant/brands'
import { fetchCoachingSession, saveCoachingSession, validateCoachingSession, type CoachingSessionDraft, type CoachingSessionPage } from '@/api/tenant/coaching'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import CoachingDayCard from './CoachingDayCard.vue'
import { useSessionText } from './coachingDisplay'
import CoachingRolePicks from './CoachingRolePicks.vue'

// The coach fills a session: a note 1 to 4 or N/A per question (with an optional comment), the open questions,
// the day's counters and brands (pre-filled from the accompanied visits), the objectives. A draft can be saved
// at any time; "Valider" needs everything. Mockup: docs/design/coaching-mockups/CoachingSessions.html (frame 3)
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const text = useSessionText()

const session = ref<CoachingSessionPage | null>(null)
const failed = ref(false)
const notes = ref<Record<number, number | null>>({})
const comments = ref<Record<number, string>>({})
const commenting = ref<Record<number, boolean>>({})
const answers = ref<Record<number, string>>({})
const form = ref({ objective: '', next_objective: '', comment: '', generalist: 0 as string | number | null, specialist: 0 as string | number | null, pharmacy: 0 as string | number | null, brand_ids: [] as number[] })

function fill(page: CoachingSessionPage) {
  session.value = page
  for (const question of page.sections.flatMap(section => section.questions)) {
    notes.value[question.id] = question.note
    comments.value[question.id] = question.response ?? ''
    commenting.value[question.id] = !!question.response
  }
  for (const open of page.open_questions) answers.value[open.id] = open.response ?? ''
  form.value = {
    objective: page.objective ?? '', next_objective: page.next_objective ?? '', comment: page.comment ?? '',
    generalist: page.counts.generalist, specialist: page.counts.specialist, pharmacy: page.counts.pharmacy,
    brand_ids: page.brands.map(brand => brand.id),
  }
}
watch(() => props.id, async () => {
  session.value = null
  failed.value = false
  try {
    const page = await fetchCoachingSession(Number(props.id))
    // Only its coach, while it is planned or refused.
    if (!page.can.update) return router.replace({ name: 'tenant-coaching-session', params: { id: page.id } })
    fill(page)
  }
  catch {
    failed.value = true
  }
}, { immediate: true })

const brands = ref<{ value: number; label: string }[]>([])
onMountedAndFocus(async () => { brands.value = (await fetchAllBrands()).map(brand => ({ value: brand.id, label: brand.name })) })

const questions = computed(() => session.value?.sections.flatMap(section => section.questions) ?? [])
const missingNotes = computed(() => questions.value.filter(question => notes.value[question.id] == null).length)
const missingAnswers = computed(() => (session.value?.open_questions ?? []).filter(open => !answers.value[open.id]?.trim()).length)
const NOTES = [1, 2, 3, 4, 0]

const draft = (): CoachingSessionDraft => ({
  objective: form.value.objective || null,
  next_objective: form.value.next_objective || null,
  comment: form.value.comment || null,
  generalist_doctors_count: Number(form.value.generalist ?? 0),
  specialist_doctors_count: Number(form.value.specialist ?? 0),
  pharmacy_count: Number(form.value.pharmacy ?? 0),
  brand_ids: form.value.brand_ids,
  responses: questions.value.map(question => ({ coaching_question_id: question.id, note: notes.value[question.id] ?? null, response: comments.value[question.id]?.trim() || null })),
  open_responses: (session.value?.open_questions ?? []).map(open => ({ coaching_open_question_id: open.id, response: answers.value[open.id]?.trim() || null })),
})

const errors = ref<Record<string, string>>({})
const saving = ref<'draft' | 'validate' | null>(null)
async function save(validate: boolean) {
  if (!session.value) return
  errors.value = {}
  saving.value = validate ? 'validate' : 'draft'
  try {
    fill(await saveCoachingSession(session.value.id, draft()))
    if (!validate) return toast.success(t('coaching.sessions.toast.draft'))
    await validateCoachingSession(session.value.id)
    toast.success(t('coaching.sessions.toast.validated'))
    router.push({ name: 'tenant-coaching-session', params: { id: session.value.id } })
  }
  catch (error) {
    errors.value = fieldErrors(error)
    toast.error(errors.value.responses ?? errors.value.date ?? errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = null
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('coaching.sessions.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-coaching-sessions' }">{{ t('coaching.sessions.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!session">
      <DlSkeleton class="h-20 rounded-2xl" />
      <div class="grid gap-4 lg:grid-cols-[1fr_400px]"><DlSkeleton class="h-96 rounded-3xl" /><DlSkeleton class="h-64 rounded-3xl" /></div>
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
            <RouterLink :to="{ name: 'tenant-coaching-sessions' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('coaching.sessions.title') }}</RouterLink>
            <span aria-hidden="true">›</span>
            <RouterLink :to="{ name: 'tenant-coaching-session', params: { id: session.id } }" class="text-dl-muted no-underline hover:text-dl-fg">{{ session.medical_rep.full_name }}</RouterLink>
          </nav>
          <h1 class="font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em] md:text-[30px]">{{ session.medical_rep.full_name }} · {{ text.day(session.date) }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('coaching.sessions.fillHint', { program: session.coaching.name }) }}</p>
        </div>
        <div class="flex flex-wrap gap-2.5">
          <DlButton variant="outline" :loading="saving === 'draft'" @click="save(false)">{{ t('coaching.sessions.actions.draft') }}</DlButton>
          <DlButton variant="dark" icon="tabler-check" :loading="saving === 'validate'" :disabled="!session.can.validate" @click="save(true)">{{ t('coaching.sessions.actions.validate') }}</DlButton>
        </div>
      </div>

      <p v-if="session.status === 'refused'" class="rounded-xl bg-dl-rejected/10 px-3.5 py-2.5 text-[13px] text-dl-rejected">
        <strong>{{ t('coaching.sessions.banner.refused', { name: session.medical_rep.full_name }) }}</strong> « {{ session.refusal_reason }} »
      </p>
      <p v-if="!session.can.validate" class="rounded-xl bg-dl-mist px-3.5 py-2.5 text-[13px]">{{ t('coaching.sessions.banner.tooEarly') }}</p>

      <div class="grid items-start gap-4 lg:grid-cols-[1fr_400px]">
        <div class="flex min-w-0 flex-col gap-4">
          <section v-for="section in session.sections" :key="section.id" class="rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="section.name">
            <h2 class="mb-1 text-sm font-semibold">{{ section.family }} › {{ section.name }}</h2>
            <div v-for="question in section.questions" :key="question.id" class="flex flex-col gap-1.5 border-b border-dl-line-soft py-2.5 last:border-b-0">
              <div class="flex flex-wrap items-center gap-3">
                <span class="min-w-0 flex-1 text-[13.5px]">{{ question.question }}</span>
                <span class="flex gap-1" role="radiogroup" :aria-label="question.question">
                  <button
                    v-for="value in NOTES"
                    :key="value"
                    type="button"
                    role="radio"
                    :aria-checked="notes[question.id] === value"
                    class="flex h-8 items-center justify-center rounded-lg border text-[13px] font-bold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
                    :class="[value === 0 ? 'w-11 text-xs font-semibold' : 'w-8', notes[question.id] === value ? 'border-dl-fg bg-dl-ink text-dl-signal' : 'border-dl-line text-dl-muted hover:border-dl-body']"
                    @click="notes[question.id] = notes[question.id] === value ? null : value"
                  >{{ value === 0 ? t('coaching.sessions.na') : value }}</button>
                </span>
                <DlButton variant="ghost" size="sm" icon="tabler-message" @click="commenting[question.id] = !commenting[question.id]">{{ t('coaching.sessions.fields.comment') }}</DlButton>
              </div>
              <DlInput v-if="commenting[question.id]" v-model="comments[question.id]" :label="t('coaching.sessions.fields.comment')" hide-label />
            </div>
          </section>

          <section v-if="session.open_questions.length" class="flex flex-col gap-3.5 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('coaching.open.title')">
            <h2 class="text-sm font-semibold">{{ t('coaching.open.title') }}</h2>
            <DlTextarea v-for="open in session.open_questions" :key="open.id" v-model="answers[open.id]" :label="open.question" :rows="2" />
          </section>

          <p v-if="missingNotes || missingAnswers" class="rounded-xl bg-dl-pending/10 px-3.5 py-2.5 text-[13px] text-dl-pending">
            {{ t('coaching.sessions.missing', { notes: missingNotes, answers: missingAnswers }) }}
          </p>
        </div>

        <div class="flex flex-col gap-4">
          <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('coaching.sessions.day.title')">
            <CoachingDayCard :visits="session.visits" />
            <div class="grid grid-cols-3 gap-2">
              <DlInput v-model="form.generalist" type="number" min="0" :label="t('coaching.sessions.counts.generalist')" :error="errors.generalist_doctors_count" />
              <DlInput v-model="form.specialist" type="number" min="0" :label="t('coaching.sessions.counts.specialist')" :error="errors.specialist_doctors_count" />
              <DlInput v-model="form.pharmacy" type="number" min="0" :label="t('coaching.sessions.counts.pharmacy')" :error="errors.pharmacy_count" />
            </div>
            <CoachingRolePicks v-model="form.brand_ids" :label="t('coaching.sessions.fields.brands')" :options="brands" :add-label="t('coaching.sessions.addBrand')" />
            <p class="text-xs text-dl-muted">{{ t('coaching.sessions.day.editable') }}</p>
          </section>

          <section class="flex flex-col gap-3.5 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('coaching.sessions.objectives')">
            <h2 class="text-sm font-semibold">{{ t('coaching.sessions.objectives') }}</h2>
            <DlTextarea v-model="form.objective" :label="t('coaching.sessions.fields.objective')" :rows="2" />
            <DlTextarea v-model="form.next_objective" :label="t('coaching.sessions.fields.nextObjective')" :rows="2" />
            <DlTextarea v-model="form.comment" :label="t('coaching.sessions.fields.comment')" :rows="3" />
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  acceptCoachingSession, cancelCoachingSession, deleteCoachingSession, fetchCoachingSession, refuseCoachingSession, saveCoachingSession,
  type CoachingSessionPage,
} from '@/api/tenant/coaching'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import CoachingDayCard from './CoachingDayCard.vue'
import { LABEL_TONE, SESSION_TONE, sessionState, useSessionText } from './coachingDisplay'
import CoachingReasonSheet from './CoachingReasonSheet.vue'

// A session's page: its score (overall %, and per section the average out of 4 with its label), its objectives, the
// notes, the day's visits. The coach fills, moves or cancels it; the person coached accepts or refuses.
// Mockup: docs/design/coaching-mockups/CoachingSessions.html (frames 4 to 8)
const props = defineProps<{ id: string }>()
const { t, n } = useI18n()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const text = useSessionText()

const session = ref<CoachingSessionPage | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    session.value = await fetchCoachingSession(Number(props.id))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { session.value = null; load() }, { immediate: true })

const person = computed(() => session.value?.medical_rep)
const noted = computed(() => session.value?.sections.some(section => section.questions.some(question => question.note != null)) ?? false)
const showNotes = ref(false)

// The coach: change the day (planned only), cancel, delete.
const moving = ref(false)
const newDay = ref<string | number | null>('')
const today = new Date().toISOString().slice(0, 10)
const errors = ref<Record<string, string>>({})
const saving = ref(false)
async function run(action: () => Promise<CoachingSessionPage>, done: string) {
  errors.value = {}
  saving.value = true
  try {
    session.value = await action()
    toast.success(done)
    moving.value = false
    reason.value = null
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
const move = () => run(() => saveCoachingSession(session.value!.id, { date: String(newDay.value) }), t('coaching.sessions.toast.moved'))

// A reason sheet serves the coach's cancel and the person's refusal.
const reason = ref<'cancel' | 'refuse' | null>(null)
const reasonOpen = computed({ get: () => reason.value !== null, set: value => { if (!value) reason.value = null } })
const sendReason = (value: string) => (reason.value === 'cancel'
  ? run(() => cancelCoachingSession(session.value!.id, value), t('coaching.sessions.toast.cancelled'))
  : run(() => refuseCoachingSession(session.value!.id, value), t('coaching.sessions.toast.refused')))
const accept = () => run(() => acceptCoachingSession(session.value!.id), t('coaching.sessions.toast.accepted'))

async function remove() {
  const ok = await confirm({ title: t('coaching.sessions.deleteTitle'), text: t('coaching.sessions.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok || !session.value) return
  try {
    await deleteCoachingSession(session.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-coaching-sessions' })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5">
      <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('coaching.sessions.notFound')">
        <DlButton variant="outline" :to="{ name: 'tenant-coaching-sessions' }">{{ t('coaching.sessions.back') }}</DlButton>
      </DlEmptyState>
      <template v-else-if="!session || !person">
        <DlSkeleton class="h-20 rounded-2xl" />
        <div class="grid gap-4 lg:grid-cols-[1fr_400px]"><DlSkeleton class="h-64 rounded-3xl" /><DlSkeleton class="h-64 rounded-3xl" /></div>
      </template>

      <template v-else>
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="flex min-w-0 flex-col gap-1.5">
            <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
              <RouterLink :to="{ name: 'tenant-coaching-sessions' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('coaching.sessions.title') }}</RouterLink>
              <span aria-hidden="true">›</span><span>{{ person.full_name }}</span>
            </nav>
            <h1 class="font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em] md:text-[30px]">{{ person.full_name }} · {{ text.day(session.date) }}</h1>
            <p class="flex flex-wrap items-center gap-2 text-[13px] text-dl-muted">
              <DlBadge size="sm" :tone="SESSION_TONE[sessionState(session)]" dot>{{ text.state(session) }}</DlBadge>
              {{ [roleLabel(person.role), person.team].filter(Boolean).join(' · ') }} ·
              {{ t('coaching.sessions.byCoach', { coach: session.coach.full_name, program: session.coaching.name }) }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2.5">
            <DlButton v-if="session.can.delete" variant="outline" icon="tabler-trash" @click="remove">{{ t('common.actions.delete') }}</DlButton>
            <DlButton v-if="session.can.cancel" variant="outline" @click="reason = 'cancel'">{{ t('coaching.sessions.actions.cancel') }}</DlButton>
            <DlButton v-if="session.can.cancel" variant="outline" icon="tabler-calendar" @click="moving = true; newDay = session.date">{{ t('coaching.sessions.actions.move') }}</DlButton>
            <DlButton v-if="session.can.update" variant="dark" icon="tabler-pencil" :to="{ name: 'tenant-coaching-session-fill', params: { id: session.id } }">
              {{ t(session.status === 'refused' ? 'coaching.sessions.actions.correct' : 'coaching.sessions.actions.fill') }}
            </DlButton>
            <template v-if="session.can.answer">
              <DlButton variant="outline" @click="reason = 'refuse'">{{ t('coaching.sessions.actions.refuse') }}</DlButton>
              <DlButton variant="dark" icon="tabler-check" :loading="saving" @click="accept">{{ t('coaching.sessions.actions.accept') }}</DlButton>
            </template>
          </div>
        </div>

        <p v-if="session.status === 'refused'" class="rounded-xl bg-dl-rejected/10 px-3.5 py-2.5 text-[13px] text-dl-rejected">
          <strong>{{ t('coaching.sessions.banner.refused', { name: person.full_name }) }}</strong> « {{ session.refusal_reason }} »
        </p>
        <p v-else-if="session.status === 'cancelled'" class="rounded-xl bg-dl-mist px-3.5 py-2.5 text-[13px]"><strong>{{ t('coaching.sessions.banner.cancelled') }}</strong> « {{ session.cancel_reason }} »</p>
        <p v-else-if="session.status === 'validated'" class="rounded-xl bg-dl-mist px-3.5 py-2.5 text-[13px]">
          {{ session.can.answer ? t('coaching.sessions.banner.answer', { coach: session.coach.full_name }) : t('coaching.sessions.banner.waiting', { name: person.full_name }) }}
        </p>
        <p v-else-if="session.is_late" class="rounded-xl bg-dl-pending/10 px-3.5 py-2.5 text-[13px] text-dl-pending">{{ t('coaching.sessions.banner.late') }}</p>

        <form v-if="moving" class="flex max-w-md flex-col gap-3 rounded-3xl bg-dl-paper p-4" @submit.prevent="move">
          <h2 class="text-sm font-semibold">{{ t('coaching.sessions.actions.move') }}</h2>
          <DlInput v-model="newDay" type="date" :min="today" :label="t('coaching.sessions.fields.newDay')" :error="errors.date" />
          <div class="flex justify-end gap-2">
            <DlButton variant="ghost" size="sm" @click="moving = false">{{ t('common.actions.cancel') }}</DlButton>
            <DlButton type="submit" variant="dark" size="sm" :loading="saving">{{ t('coaching.sessions.actions.moveSave') }}</DlButton>
          </div>
        </form>

        <div class="grid items-start gap-4 lg:grid-cols-[1fr_400px]">
          <div class="flex min-w-0 flex-col gap-4">
            <section v-if="session.score != null" class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('coaching.sessions.columns.score')">
              <h2 class="text-sm font-semibold">{{ t('coaching.sessions.columns.score') }}</h2>
              <div class="flex items-end gap-3.5">
                <span class="font-display text-[46px] font-extrabold leading-none">{{ text.score(session.score) }}</span>
                <span v-if="session.previous_score != null" class="text-[13px] text-dl-muted">{{ t('coaching.sessions.previous', { score: text.score(session.previous_score) }) }}</span>
              </div>
              <div v-for="section in session.sections" :key="section.id" class="flex items-center gap-3 text-[13px]">
                <span class="w-40 shrink-0 truncate">{{ section.name }}</span>
                <span class="h-2 flex-1 overflow-hidden rounded-full bg-dl-line-soft"><span class="block h-full rounded-full bg-dl-ink" :style="{ width: `${((section.average ?? 0) / 4) * 100}%` }" /></span>
                <b class="w-8 text-end tabular-nums">{{ text.average(section.average) }}</b>
                <DlBadge v-if="section.label" size="sm" :tone="LABEL_TONE[section.label]">{{ text.label(section.label) }}</DlBadge>
              </div>
            </section>

            <section class="rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('coaching.sessions.objectives')">
              <h2 class="mb-2 text-sm font-semibold">{{ t('coaching.sessions.objectives') }}</h2>
              <dl class="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt class="text-dl-muted">{{ t('coaching.sessions.fields.objective') }}</dt><dd>{{ session.objective || '—' }}</dd>
                <dt class="text-dl-muted">{{ t('coaching.sessions.fields.nextObjective') }}</dt><dd>{{ session.next_objective || '—' }}</dd>
                <dt class="text-dl-muted">{{ t('coaching.sessions.fields.comment') }}</dt><dd>{{ session.comment || '—' }}</dd>
              </dl>
            </section>

            <section v-if="noted" class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('coaching.sessions.grid')">
              <div class="flex items-center gap-2">
                <h2 class="flex-1 text-sm font-semibold">{{ t('coaching.sessions.grid') }}</h2>
                <DlButton variant="outline" size="sm" @click="showNotes = !showNotes">{{ t(showNotes ? 'coaching.sessions.hideNotes' : 'coaching.sessions.showNotes') }}</DlButton>
              </div>
              <template v-if="showNotes">
                <div v-for="section in session.sections" :key="section.id" class="text-[13px]">
                  <strong class="mt-2 block">{{ section.family }} › {{ section.name }}</strong>
                  <div v-for="question in section.questions" :key="question.id" class="flex items-baseline gap-3 border-b border-dl-line-soft py-1.5 last:border-b-0">
                    <span class="min-w-0 flex-1">{{ question.question }}<small v-if="question.response" class="block text-xs text-dl-muted">« {{ question.response }} »</small></span>
                    <b class="tabular-nums">{{ question.note == null ? '—' : question.note === 0 ? t('coaching.sessions.na') : n(question.note) }}</b>
                  </div>
                </div>
                <div v-for="open in session.open_questions" :key="open.id" class="text-[13px]">
                  <strong class="mt-2 block">{{ open.question }}</strong>
                  <p class="text-dl-body">{{ open.response || '—' }}</p>
                </div>
              </template>
            </section>
          </div>

          <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('coaching.sessions.day.title')">
            <CoachingDayCard :visits="session.visits" />
            <dl class="grid grid-cols-3 gap-2 text-center text-[13px]">
              <div v-for="key in (['generalist', 'specialist', 'pharmacy'] as const)" :key="key" class="rounded-xl bg-dl-mist px-2 py-2">
                <dd class="text-lg font-bold tabular-nums">{{ n(session.counts[key]) }}</dd>
                <dt class="text-xs text-dl-muted">{{ t(`coaching.sessions.counts.${key}`) }}</dt>
              </div>
            </dl>
            <p v-if="session.brands.length" class="flex flex-wrap items-center gap-1.5 text-[13px]">
              {{ t('coaching.sessions.fields.brands') }} : <DlBadge v-for="brand in session.brands" :key="brand.id" size="sm">{{ brand.name }}</DlBadge>
            </p>
            <p class="text-xs text-dl-muted">{{ t(session.counts.from_visits ? 'coaching.sessions.day.fromVisits' : 'coaching.sessions.day.saved') }}</p>
          </section>
        </div>
      </template>
    </div>

    <CoachingReasonSheet
      v-if="reasonOpen"
      v-model:open="reasonOpen"
      :title="t(reason === 'cancel' ? 'coaching.sessions.cancelTitle' : 'coaching.sessions.refuseTitle')"
      :text="t(reason === 'cancel' ? 'coaching.sessions.cancelText' : 'coaching.sessions.refuseText', { coach: session?.coach.full_name })"
      :confirm-label="t(reason === 'cancel' ? 'coaching.sessions.actions.cancel' : 'coaching.sessions.actions.refuseConfirm')"
      :saving="saving"
      :error="errors.reason"
      @confirm="sendReason"
    />
  </div>
</template>

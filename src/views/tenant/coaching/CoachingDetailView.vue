<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  createCoachingOpenQuestion, deleteCoaching, deleteCoachingOpenQuestion, fetchCoaching, updateCoaching, updateCoachingOpenQuestion,
  type Coaching, type CoachingOpenQuestion, type CoachingPayload,
} from '@/api/tenant/coaching'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import CoachingRolePicks from './CoachingRolePicks.vue'
import CoachingSectionPicker from './CoachingSectionPicker.vue'
import { STATE_TONE, useCoachingText } from './coachingDisplay'
import { useCoachingLookups } from './useCoachingLookups'

// A program's page: four cards edited in place (the program, who coaches whom, the sections, the open questions).
// Mockup: docs/design/coaching-mockups/CoachingSetup.html (frames 5, 6)
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useCoachingText()
const { roleOptions, families } = useCoachingLookups()
const canEdit = computed(() => auth.can('coaching-setup.update'))

const coaching = ref<Coaching | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    coaching.value = await fetchCoaching(Number(props.id))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { coaching.value = null; load() }, { immediate: true })

// One card in edit at a time; its fields start from the program.
type Card = 'program' | 'roles' | 'sections'
const editing = ref<Card | null>(null)
const form = ref({ name: '', start_date: '', end_date: '', coach_role_ids: [] as number[], coached_role_ids: [] as number[], category_ids: [] as number[] })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function edit(card: Card | null) {
  const row = coaching.value
  if (!row) return
  form.value = {
    name: row.name, start_date: row.start_date, end_date: row.end_date,
    coach_role_ids: row.coach_roles.map(role => role.id), coached_role_ids: row.coached_roles.map(role => role.id),
    category_ids: row.sections.map(section => section.id),
  }
  errors.value = {}
  editing.value = card
}
const editingCard = (card: Card) => computed({ get: () => editing.value === card, set: value => edit(value ? card : null) })
const editProgram = editingCard('program')
const editRoles = editingCard('roles')
const editSections = editingCard('sections')

const SENT: Record<Card, (keyof CoachingPayload)[]> = {
  program: ['name', 'start_date', 'end_date'],
  roles: ['coach_role_ids', 'coached_role_ids'],
  sections: ['category_ids'],
}
async function save(card: Card) {
  if (!coaching.value) return
  errors.value = {}
  saving.value = true
  try {
    const payload = Object.fromEntries(SENT[card].map(key => [key, form.value[key]])) as CoachingPayload
    coaching.value = { ...coaching.value, ...(await updateCoaching(coaching.value.id, payload)) }
    editing.value = null
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

async function remove() {
  if (!coaching.value) return
  const ok = await confirm({ title: t('coaching.page.deleteTitle', { name: coaching.value.name }), text: t('coaching.page.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteCoaching(coaching.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-coachings' })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

// Open questions: added at the end, changed in place, moved, deleted.
const newQuestion = ref('')
const changing = ref<number | null>(null)
const changed = ref('')
const openQuestions = computed(() => coaching.value?.open_questions ?? [])
async function run(action: () => Promise<unknown>) {
  try {
    await action()
    await load()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const addOpen = () => newQuestion.value.trim() && coaching.value && run(async () => {
  await createCoachingOpenQuestion(coaching.value!.id, newQuestion.value.trim())
  newQuestion.value = ''
})
const startChange = (question: CoachingOpenQuestion) => { changing.value = question.id; changed.value = question.question }
const saveChange = (question: CoachingOpenQuestion) => run(async () => {
  await updateCoachingOpenQuestion(question.id, { question: changed.value })
  changing.value = null
})
const move = (question: CoachingOpenQuestion, by: number) => run(() => updateCoachingOpenQuestion(question.id, { sort: question.sort + by }))
async function removeOpen(question: CoachingOpenQuestion) {
  const ok = await confirm({ title: t('coaching.open.deleteTitle'), text: question.question, confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (ok) await run(() => deleteCoachingOpenQuestion(question.id))
}

const sectionsByFamily = computed(() => {
  const groups = new Map<string, Coaching['sections']>()
  for (const section of coaching.value?.sections ?? []) groups.set(section.family.name, [...(groups.get(section.family.name) ?? []), section])
  return [...groups.entries()]
})
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('coaching.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-coachings' }">{{ t('coaching.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!coaching">
      <DlSkeleton class="h-20 rounded-2xl" />
      <div class="grid gap-4 lg:grid-cols-2"><DlSkeleton class="h-48 rounded-3xl" /><DlSkeleton class="h-48 rounded-3xl" /></div>
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
            <RouterLink :to="{ name: 'tenant-coachings' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('coaching.programs.title') }}</RouterLink>
            <span aria-hidden="true">›</span><span>{{ coaching.name }}</span>
          </nav>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ coaching.name }}</h1>
          <p class="flex flex-wrap items-center gap-2 text-[13px] text-dl-muted">
            <DlBadge size="sm" :tone="STATE_TONE[coaching.state]" dot>{{ text.state(coaching.state) }}</DlBadge>
            <span v-if="coaching.created_by">{{ t('coaching.page.addedBy', { name: coaching.created_by.full_name, date: text.date(coaching.created_at) }) }}</span>
            · {{ t('coaching.page.sessions', coaching.sessions_count) }}
          </p>
        </div>
        <DlButton v-if="auth.can('coaching-setup.delete')" variant="outline" icon="tabler-trash" @click="remove">{{ t('common.actions.delete') }}</DlButton>
      </div>

      <div class="grid items-start gap-4 lg:grid-cols-2">
        <div class="flex flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-5">
          <DlRecordSection v-model:editing="editProgram" :title="t('coaching.page.program')" icon="tabler-clipboard-text" :can-edit="canEdit" :saving="saving" @save="save('program')" @cancel="edit(null)">
            <dl class="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5">
              <dt class="text-dl-muted">{{ t('coaching.fields.name') }}</dt><dd>{{ coaching.name }}</dd>
              <dt class="text-dl-muted">{{ t('coaching.fields.from') }}</dt><dd>{{ text.date(coaching.start_date) }}</dd>
              <dt class="text-dl-muted">{{ t('coaching.fields.to') }}</dt><dd>{{ text.date(coaching.end_date) }}</dd>
            </dl>
            <template #edit>
              <DlInput v-model="form.name" :label="t('coaching.fields.name')" :error="errors.name" />
              <div class="grid grid-cols-2 gap-3">
                <DlInput v-model="form.start_date" type="date" :label="t('coaching.fields.from')" :error="errors.start_date" />
                <DlInput v-model="form.end_date" type="date" :label="t('coaching.fields.to')" :error="errors.end_date || errors.coached_role_ids" />
              </div>
            </template>
          </DlRecordSection>

          <DlRecordSection v-model:editing="editRoles" :title="t('coaching.page.roles')" icon="tabler-users" :can-edit="canEdit" :saving="saving" @save="save('roles')" @cancel="edit(null)">
            <dl class="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2">
              <dt class="text-dl-muted">{{ t('coaching.fields.coaches') }}</dt>
              <dd class="flex flex-wrap gap-1"><DlBadge v-for="role in coaching.coach_roles" :key="role.id" size="sm">{{ roleLabel(role.name) }}</DlBadge></dd>
              <dt class="text-dl-muted">{{ t('coaching.fields.coached') }}</dt>
              <dd class="flex flex-wrap gap-1"><DlBadge v-for="role in coaching.coached_roles" :key="role.id" size="sm">{{ roleLabel(role.name) }}</DlBadge></dd>
            </dl>
            <template #edit>
              <CoachingRolePicks v-model="form.coach_role_ids" :label="t('coaching.fields.coaches')" :options="roleOptions" :error="errors.coach_role_ids" />
              <CoachingRolePicks v-model="form.coached_role_ids" :label="t('coaching.fields.coached')" :options="roleOptions" :error="errors.coached_role_ids" />
            </template>
          </DlRecordSection>
        </div>

        <div class="flex flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-5">
          <DlRecordSection v-model:editing="editSections" :title="t('coaching.fields.sections')" icon="tabler-list-check" :can-edit="canEdit" :saving="saving" @save="save('sections')" @cancel="edit(null)">
            <div class="flex flex-col gap-2">
              <div v-for="[family, rows] in sectionsByFamily" :key="family">
                <strong class="text-[13px]">{{ family }}</strong>
                <ul class="mt-1 flex flex-col gap-0.5 ps-4">
                  <li v-for="section in rows" :key="section.id" class="flex justify-between gap-2">
                    <span>{{ section.name }}</span><span class="text-xs text-dl-muted">{{ t('coaching.grid.activeCount', section.active_count) }}</span>
                  </li>
                </ul>
              </div>
            </div>
            <template #edit>
              <CoachingSectionPicker v-model="form.category_ids" :families="families" :error="errors.category_ids || errors['category_ids.0']" />
            </template>
          </DlRecordSection>

          <section class="rounded-2xl border border-dl-line" :aria-label="t('coaching.open.title')">
            <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
              <span class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-dl-line-soft text-dl-body"><DlIcon icon="tabler-message-question" :size="17" /></span>
              <h3 class="flex-1 text-sm font-semibold">{{ t('coaching.open.title') }}</h3>
            </header>
            <div class="flex flex-col gap-1 px-3.5 pb-3 text-[13px]">
              <p class="text-dl-muted">{{ t('coaching.open.hint') }}</p>
              <p v-if="!openQuestions.length" class="py-2 text-dl-muted">{{ t('coaching.open.none') }}</p>
              <div v-for="(question, i) in openQuestions" :key="question.id" class="flex items-center gap-2 border-b border-dl-line-soft py-1.5 last:border-b-0">
                <span class="w-5 tabular-nums text-dl-muted">{{ question.sort }}</span>
                <template v-if="changing === question.id">
                  <div class="flex-1"><DlInput v-model="changed" :label="t('coaching.open.question')" hide-label /></div>
                  <DlButton size="sm" variant="dark" @click="saveChange(question)">{{ t('common.actions.save') }}</DlButton>
                  <DlButton size="sm" variant="ghost" @click="changing = null">{{ t('common.actions.cancel') }}</DlButton>
                </template>
                <template v-else>
                  <span class="min-w-0 flex-1">{{ question.question }}</span>
                  <template v-if="canEdit">
                    <DlIconButton icon="tabler-chevron-up" variant="ghost" :size="28" :label="t('coaching.question.up')" :disabled="i === 0" @click="move(question, -1)" />
                    <DlIconButton icon="tabler-chevron-down" variant="ghost" :size="28" :label="t('coaching.question.down')" :disabled="i === openQuestions.length - 1" @click="move(question, 1)" />
                    <DlIconButton icon="tabler-pencil" variant="ghost" :size="28" :label="t('common.actions.edit')" @click="startChange(question)" />
                    <DlIconButton icon="tabler-trash" variant="ghost" :size="28" :label="t('common.actions.delete')" @click="removeOpen(question)" />
                  </template>
                </template>
              </div>
              <form v-if="canEdit" class="mt-2 flex items-end gap-2" @submit.prevent="addOpen">
                <div class="flex-1"><DlInput v-model="newQuestion" :label="t('coaching.open.add')" :placeholder="t('coaching.open.placeholder')" hide-label /></div>
                <DlButton type="submit" size="sm" variant="outline" icon="tabler-plus">{{ t('coaching.open.addButton') }}</DlButton>
              </form>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import {
  deleteCoachingCategory, deleteCoachingQuestion, fetchCoachingQuestions, fetchCoachingTree, updateCoachingQuestion,
  type CoachingFamily, type CoachingQuestion,
} from '@/api/tenant/coaching'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlMenu, { type DlMenuItem } from '@/components/DlMenu.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import CoachingCategorySheet from './CoachingCategorySheet.vue'
import CoachingQuestionSheet from './CoachingQuestionSheet.vue'

// Coaching › Grille d'évaluation: the families and their sections on the left, the questions of the chosen section
// on the right, in the order the coach sees them. Mockup: docs/design/coaching-mockups/CoachingSetup.html (frames 1, 2, 7)
const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const can = (action: string) => auth.can(`coaching-setup.${action}`)

const families = ref<CoachingFamily[] | null>(null)
const sectionId = ref<number | null>(null)
const questions = ref<CoachingQuestion[]>([])
const loadingQuestions = ref(false)

const sections = computed(() => (families.value ?? []).flatMap(family => family.sections.map(section => ({ ...section, family }))))
const section = computed(() => sections.value.find(row => row.id === sectionId.value) ?? null)

async function loadTree() {
  families.value = await fetchCoachingTree()
  if (!section.value) sectionId.value = sections.value[0]?.id ?? null
}
async function loadQuestions() {
  if (!sectionId.value) {
    questions.value = []
    return
  }
  loadingQuestions.value = true
  try {
    questions.value = await fetchCoachingQuestions(sectionId.value)
  }
  finally {
    loadingQuestions.value = false
  }
}
async function reload() {
  await loadTree()
  await loadQuestions()
}
reload()

function pick(id: number) {
  sectionId.value = id
  loadQuestions()
}

// Families and sections: add, rename, delete.
const categoryOpen = ref(false)
const categoryEdited = ref<{ id: number; name: string } | null>(null)
const categoryFamily = ref<{ id: number; name: string } | null>(null)
function editCategory(category: { id: number; name: string } | null, family: { id: number; name: string } | null = null) {
  categoryEdited.value = category
  categoryFamily.value = family
  categoryOpen.value = true
}
async function removeCategory(category: { id: number; name: string }) {
  const ok = await confirm({ title: t('coaching.grid.deleteTitle', { name: category.name }), text: t('coaching.grid.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteCoachingCategory(category.id)
    toast.success(t('studio.list.toast.deleted'))
    if (sectionId.value === category.id) sectionId.value = null
    await reload()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const categoryMenu = (category: { id: number; name: string }, family: { id: number; name: string } | null): DlMenuItem[] => [
  ...(can('update') ? [{ label: t('coaching.grid.rename'), icon: 'tabler-pencil', onSelect: () => editCategory(category, family) }] : []),
  ...(can('delete') ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: () => removeCategory(category) }] : []),
]

// Questions: add, change, move, turn on / off, delete.
const questionOpen = ref(false)
const questionEdited = ref<CoachingQuestion | null>(null)
function editQuestion(question: CoachingQuestion | null) {
  questionEdited.value = question
  questionOpen.value = true
}
async function onQuestionSaved(saved: CoachingQuestion) {
  if (saved.coaching_category_id !== sectionId.value) sectionId.value = saved.coaching_category_id
  await reload()
}
async function change(question: CoachingQuestion, payload: Partial<CoachingQuestion>) {
  try {
    await updateCoachingQuestion(question.id, payload)
    await reload()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
async function removeQuestion(question: CoachingQuestion) {
  const ok = await confirm({ title: t('coaching.question.deleteTitle'), text: question.question, confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteCoachingQuestion(question.id)
    toast.success(t('studio.list.toast.deleted'))
    await reload()
  }
  catch (error) {
    // Noted in sessions (11b): the API says to turn it off instead.
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const activeCount = computed(() => questions.value.filter(question => question.is_active).length)
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.coaching') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('coaching.grid.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('coaching.grid.subtitle') }}</p>
        </div>
      </div>

      <div v-if="!families" class="grid gap-4 lg:grid-cols-[330px_1fr]"><DlSkeleton class="h-80 rounded-3xl" /><DlSkeleton class="h-80 rounded-3xl" /></div>

      <div v-else class="grid items-start gap-4 lg:grid-cols-[330px_1fr]">
        <!-- Families and sections -->
        <section class="flex flex-col gap-1 rounded-3xl bg-dl-paper p-4" :aria-label="t('coaching.grid.categories')">
          <div class="mb-2 flex items-center gap-2">
            <h2 class="flex-1 text-sm font-bold">{{ t('coaching.grid.categories') }}</h2>
            <DlButton v-if="can('create')" variant="outline" size="sm" icon="tabler-plus" @click="editCategory(null)">{{ t('coaching.grid.family') }}</DlButton>
          </div>
          <p v-if="!families.length" class="px-2 py-3 text-[13px] text-dl-muted">{{ t('coaching.grid.emptyText') }}</p>
          <template v-for="family in families" :key="family.id">
            <div class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold">
              <span class="flex-1">{{ family.name }}</span>
              <small class="text-xs font-normal text-dl-muted">{{ t('coaching.grid.sectionsCount', family.sections.length) }}</small>
              <DlMenu v-if="categoryMenu(family, null).length" :label="t('coaching.grid.actions', { name: family.name })" :items="categoryMenu(family, null)" always-menu />
            </div>
            <div
              v-for="row in family.sections"
              :key="row.id"
              class="flex cursor-pointer items-center gap-2 rounded-xl py-2 ps-7 pe-3 text-sm hover:bg-dl-line-soft"
              :class="row.id === sectionId && 'bg-dl-signal-soft hover:bg-dl-signal-soft'"
              role="button"
              tabindex="0"
              @click="pick(row.id)"
              @keydown.enter="pick(row.id)"
            >
              <span class="flex-1">{{ row.name }}</span>
              <small class="text-xs text-dl-muted">{{ t('coaching.grid.questionsCount', row.questions_count) }}</small>
              <span @click.stop><DlMenu v-if="categoryMenu(row, family).length" :label="t('coaching.grid.actions', { name: row.name })" :items="categoryMenu(row, family)" always-menu /></span>
            </div>
            <button v-if="can('create')" type="button" class="rounded-xl py-1.5 ps-7 text-start text-[13px] font-semibold text-dl-cobalt hover:underline" @click="editCategory(null, family)">
              + {{ t('coaching.grid.section') }}
            </button>
          </template>
        </section>

        <!-- The chosen section's questions -->
        <section class="flex min-w-0 flex-col gap-1 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('coaching.grid.questions')">
          <DlEmptyState v-if="!section" icon="tabler-list-check" :title="t('coaching.grid.noSection')" :text="t('coaching.grid.noSectionText')" />
          <template v-else>
            <div class="mb-2 flex flex-wrap items-center gap-3">
              <div class="min-w-0">
                <div class="text-xs text-dl-muted">{{ section.family.name }} ›</div>
                <h2 class="text-[17px] font-bold">{{ section.name }}</h2>
              </div>
              <span class="text-[13px] text-dl-muted">{{ t('coaching.grid.questionsLine', { count: questions.length, active: activeCount }) }}</span>
              <DlButton v-if="can('create')" variant="dark" size="sm" icon="tabler-plus" class="ms-auto" @click="editQuestion(null)">{{ t('coaching.question.addButton') }}</DlButton>
            </div>
            <DlSkeleton v-if="loadingQuestions && !questions.length" class="h-40 rounded-2xl" />
            <p v-else-if="!questions.length" class="py-6 text-center text-[13px] text-dl-muted">{{ t('coaching.grid.noQuestion') }}</p>
            <ol v-else class="flex flex-col">
              <li v-for="(question, i) in questions" :key="question.id" class="flex items-center gap-3 border-b border-dl-line-soft py-2 last:border-b-0">
                <span v-if="can('update')" class="flex flex-col">
                  <DlIconButton icon="tabler-chevron-up" variant="ghost" :size="24" :label="t('coaching.question.up')" :disabled="i === 0" @click="change(question, { sort: question.sort - 1 })" />
                  <DlIconButton icon="tabler-chevron-down" variant="ghost" :size="24" :label="t('coaching.question.down')" :disabled="i === questions.length - 1" @click="change(question, { sort: question.sort + 1 })" />
                </span>
                <span class="w-6 text-sm tabular-nums text-dl-muted">{{ question.sort }}</span>
                <span class="min-w-0 flex-1 text-sm" :class="!question.is_active && 'text-dl-muted line-through'">{{ question.question }}</span>
                <DlBadge v-if="!question.is_active" size="sm">{{ t('coaching.question.off') }}</DlBadge>
                <DlSwitch v-if="can('update')" :model-value="question.is_active" :label="''" :aria-label="t('coaching.question.active')" @update:model-value="value => change(question, { is_active: value })" />
                <DlMenu
                  v-if="can('update') || can('delete')"
                  :label="t('coaching.question.actions')"
                  :items="[
                    ...(can('update') ? [{ label: t('common.actions.edit'), icon: 'tabler-pencil', onSelect: () => editQuestion(question) }] : []),
                    ...(can('delete') ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: () => removeQuestion(question) }] : []),
                  ]"
                  always-menu
                />
              </li>
            </ol>
          </template>
        </section>
      </div>
    </div>

    <CoachingCategorySheet v-if="categoryOpen" v-model:open="categoryOpen" :category="categoryEdited" :family="categoryFamily" @saved="reload" />
    <CoachingQuestionSheet
      v-else-if="questionOpen && families && section"
      v-model:open="questionOpen"
      :families="families"
      :section-id="section.id"
      :question="questionEdited"
      :count="questions.length"
      @saved="onQuestionSaved"
    />
  </div>
</template>

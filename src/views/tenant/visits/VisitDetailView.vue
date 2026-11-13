<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { approveVisit, deleteVisit, fetchVisit, rejectVisit, updateVisit, type Visit, type VisitOfferedAdv, type VisitPayload, type VisitShort } from '@/api/tenant/visits'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlMenu from '@/components/DlMenu.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import VisitCancelSheet from './VisitCancelSheet.vue'
import { usePlanningSave } from './visitPlanning'
import VisitNoteSheet from './VisitNoteSheet.vue'
import VisitReopenSheet from './VisitReopenSheet.vue'
import { useVisitText } from './visitDisplay'
import VisitReportFields from './VisitReportFields.vue'
import { emptyReport, givesStock, offeredAdvs, reportOf, reportPayload, useVisitLookups } from './useVisitForm'

// A visit's page: the report on the left (brands, ADVs shown, objectives and comment), the visit, the people and
// the visits before and after on the right. Each card is edited in place; a planned visit gets "Saisir le compte
// rendu" and "Annuler la visite". Mockup: docs/design/visits-mockups/Visits.html (frames 3–4)
const props = defineProps<{ id: string }>()
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useVisitText()
const { brands, canals, coaches } = useVisitLookups()

const visit = ref<Visit | null>(null)
const failed = ref(false)
async function load() {
  visit.value = null
  failed.value = false
  editing.value = null
  try {
    visit.value = await fetchVisit(Number(props.id))
  }
  catch {
    failed.value = true
  }
}

const isDone = computed(() => visit.value?.status === 'done')
// The late-entry delay (docs/api/visit-planning.md): once passed, nothing can be done on the visit.
const locked = computed(() => !!visit.value?.lock?.locked)
const canEdit = computed(() => auth.can('visits.update') && visit.value?.status !== 'cancelled' && !locked.value)
// A day is reopened for someone else, by a person who can change their visits (the API checks the hierarchy).
const canReopen = computed(() => locked.value && auth.can('visits.update') && visit.value?.user?.id !== auth.user?.id)
const reopening = ref(false)
// The cycle's plan (docs/api/visit-approval.md): someone above the person approves or rejects a waiting visit here too.
const decides = computed(() => visit.value?.status === 'planned' && (visit.value.approval === 'waiting' || visit.value.approval === 'rejected') && auth.can('visits.validate') && visit.value.user?.id !== auth.user?.id)
const rejecting = ref(false)
async function approveIt() {
  if (!visit.value) return
  try {
    visit.value = await approveVisit(visit.value.id)
    toast.success(t('visits.approval.toast.visitApproved'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const rejectIt = (note: string) => rejectVisit(visit.value!.id, note).then((updated) => { visit.value = updated })
const APPROVAL_TONE = { draft: 'neutral', waiting: 'warning', approved: 'info', rejected: 'danger' } as const
const planning = usePlanningSave()
const stock = computed(() => !!visit.value && givesStock(visit.value.target.type, visit.value.target.kind))
const targetLink = computed(() => (visit.value?.target.type === 'hcp' && auth.can('hcps.show') ? { name: 'tenant-hcp-detail', params: { id: visit.value.target.id } } : null))

// ── Cards edited in place: one at a time ────────────────────────────────────
type Part = 'visit' | 'brands' | 'advs' | 'people' | 'notes'
const editing = ref<Part | null>(null)
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const form = reactive({ date: '', time: '', canal_id: null as number | null, objective: '', next_objective: '', comment: '' })
const report = ref(emptyReport())
const replacing = ref(false)
const offered = ref<VisitOfferedAdv[]>([])
const query = computed(() => (visit.value ? { user_id: visit.value.user?.id, visitable_type: visit.value.target.type, visitable_id: visit.value.target.id, date: visit.value.visit_date } : null))

async function edit(part: Part) {
  if (!visit.value) return
  Object.assign(form, {
    date: visit.value.visit_date, time: visit.value.visit_time ?? '', canal_id: visit.value.canal?.id ?? null,
    objective: visit.value.objective ?? '', next_objective: visit.value.next_objective ?? '', comment: visit.value.comment ?? '',
  })
  report.value = reportOf(visit.value)
  replacing.value = !!visit.value.replacement
  errors.value = {}
  editing.value = part
  if (part === 'advs' && query.value) {
    // The ADVs already on the visit stay in the list, even put offline since.
    const shown = (visit.value.advs ?? []).map(adv => ({ id: adv.id, name: adv.name, type: adv.type, brand: adv.brand, slides_count: 0 }))
    offered.value = await offeredAdvs(query.value, report.value, shown).catch(() => shown)
  }
}
async function save() {
  if (!visit.value || !editing.value) return
  const payload: VisitPayload = editing.value === 'visit'
    ? { visit_date: form.date, visit_time: form.time || null, canal_id: form.canal_id ?? undefined, ...(isDone.value ? {} : { objective: form.objective.trim() || null }) }
    : editing.value === 'notes'
      ? { objective: form.objective.trim() || null, next_objective: form.next_objective.trim() || null, comment: form.comment.trim() || null }
      : reportPayload(report.value, [editing.value])
  busy.value = true
  const id = visit.value.id
  // A planned visit moved to another day goes through the planning checks (a weekend asks to confirm).
  const saved = await planning.save(body => updateVisit(id, body), payload, (error) => {
    errors.value = fieldErrors(error)
    return Object.keys(errors.value).length > 0
  })
  busy.value = false
  if (!saved) return
  visit.value = saved
  toast.success(t('studio.list.toast.saved'))
  editing.value = null
}
const canalModel = computed({ get: () => form.canal_id, set: value => { form.canal_id = value == null ? null : Number(value) } })
const section = (part: Part) => ({ editing: editing.value === part, canEdit: canEdit.value && editing.value === null, saving: busy.value })

// ── Cancel and delete ───────────────────────────────────────────────────────
const cancelling = ref(false)
async function remove() {
  if (!visit.value) return
  const ok = await confirm({ title: t('visits.delete.title'), text: t('visits.delete.text'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteVisit(visit.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-visits' })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const menuItems = computed(() => (auth.can('visits.delete') ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: remove }] : []))
const around = computed(() => ([['previous', visit.value?.previous], ['next', visit.value?.next]] as [string, VisitShort | null | undefined][]))

watch(() => props.id, load, { immediate: true })
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('visits.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-visits' }">{{ t('visits.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!visit">
      <DlSkeleton class="h-20 rounded-2xl" />
      <div class="grid gap-4 lg:grid-cols-[1fr_380px]"><DlSkeleton class="h-64 rounded-3xl" /><DlSkeleton class="h-64 rounded-3xl" /></div>
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
            <RouterLink :to="{ name: 'tenant-visits' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('visits.title') }}</RouterLink>
            <span aria-hidden="true">›</span><span>{{ visit.target.name }} · {{ text.date(visit.visit_date) }}</span>
          </nav>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ visit.target.name }}</h1>
          <p class="flex flex-wrap items-center gap-2 text-[13px] text-dl-muted">
            <DlBadge size="sm" :tone="text.tone(visit)" dot>{{ text.state(visit) }}</DlBadge>
            <DlBadge v-if="visit.off_list" size="sm" tone="warning">{{ t('visits.offList') }}</DlBadge>
            <DlBadge v-if="visit.after_deadline" size="sm" tone="info">{{ t('visits.planning.afterDeadline') }}</DlBadge>
            <DlBadge v-if="visit.status === 'planned' && visit.approval" size="sm" :tone="APPROVAL_TONE[visit.approval]">{{ t(`visits.approval.state.${visit.approval}`) }}</DlBadge>
            <DlBadge v-if="visit.unapproved" size="sm" tone="warning">{{ t('visits.approval.unapproved') }}</DlBadge>
            {{ text.where(visit.target) }}
            <RouterLink v-if="targetLink" :to="targetLink" class="text-dl-cobalt no-underline hover:underline">{{ t('visits.page.seeRecord') }}</RouterLink>
          </p>
        </div>
        <div class="flex flex-wrap gap-2.5">
          <template v-if="decides">
            <DlButton v-if="visit.approval === 'waiting'" variant="outline" @click="rejecting = true">{{ t('visits.approval.rejectVisit') }}</DlButton>
            <DlButton variant="dark" icon="tabler-check" @click="approveIt">{{ t('visits.approval.approveVisit') }}</DlButton>
          </template>
          <template v-if="visit.status === 'planned' && canEdit">
            <DlButton variant="outline" @click="cancelling = true">{{ t('visits.cancel.title') }}</DlButton>
            <DlButton v-if="visit.approval !== 'rejected'" variant="primary" icon="tabler-clipboard-check" :to="{ name: 'tenant-visit-report', params: { id: visit.id } }">{{ t('visits.report.title') }}</DlButton>
          </template>
          <DlButton v-if="canReopen" variant="primary" icon="tabler-lock-open" @click="reopening = true">{{ t('visits.reopen.title') }}</DlButton>
          <DlMenu v-if="menuItems.length" :label="t('visits.page.menu')" :items="menuItems" />
        </div>
      </div>

      <p v-if="locked" class="rounded-2xl bg-dl-rejected/8 px-4 py-3 text-[13.5px] text-dl-rejected">
        <strong>{{ t('visits.lock.title') }}</strong> {{ t(canReopen ? 'visits.lock.manager' : 'visits.lock.text') }}
      </p>
      <p v-else-if="visit.lock?.open_until" class="rounded-2xl bg-dl-signal-soft px-4 py-3 text-[13.5px]">{{ t('visits.lock.reopened') }}</p>
      <p v-else-if="visit.late" class="rounded-2xl bg-dl-pending/8 px-4 py-3 text-[13.5px] text-dl-pending">
        <strong>{{ t('visits.late.title', { day: text.dayLong(visit.visit_date) }) }}</strong> {{ t('visits.late.hint') }}
      </p>
      <p v-if="visit.status === 'planned' && visit.approval === 'rejected'" class="rounded-2xl bg-dl-rejected/8 px-4 py-3 text-[13.5px] text-dl-rejected">
        <strong>{{ t('visits.approval.rejectedBy', { name: visit.approved_by?.full_name ?? '—', date: text.date(visit.approved_at) }) }}</strong>
        <template v-if="visit.approval_note"> « {{ visit.approval_note }} »</template> {{ t('visits.approval.rejectedHint') }}
      </p>
      <p v-else-if="visit.status === 'planned' && (visit.approval === 'waiting' || visit.approval === 'draft')" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13.5px] text-dl-muted">{{ t(`visits.approval.hint.${visit.approval}`) }}</p>
      <p v-if="visit.status === 'cancelled'" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13.5px]">
        <strong>{{ t('visits.cancel.because', { reason: visit.cancel_reason?.name ?? '—' }) }}</strong>
        <template v-if="visit.cancel_note"> {{ visit.cancel_note }}</template>
      </p>

      <div class="flex items-start gap-5 max-lg:flex-col">
        <div class="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
          <template v-if="isDone">
            <DlRecordSection v-bind="section('brands')" :title="t('visits.blocks.brandsN', { n: n(visit.brands.length) })" icon="tabler-tags" class="bg-dl-paper" @update:editing="edit('brands')" @save="save" @cancel="editing = null">
              <ul class="flex flex-col text-[13.5px]">
                <li v-for="brand in visit.brands" :key="brand.id" class="flex items-center gap-3 border-b border-dl-line-soft py-2 last:border-0">
                  <span class="min-w-0 flex-1"><strong class="font-semibold">{{ brand.name }}</strong><small v-if="brand.stock != null" class="block text-xs text-dl-muted">{{ t('visits.brands.stockOf', { n: n(brand.stock) }) }}</small></span>
                  <span v-if="brand.feedback" class="font-bold">{{ brand.feedback }}<small class="font-normal text-dl-muted"> / 5</small></span>
                  <span v-else class="text-xs text-dl-muted">{{ t('visits.brands.noInterest') }}</span>
                </li>
              </ul>
              <template #edit>
                <VisitReportFields v-model="report" part="brands" :brand-options="brands" :stock="stock" :offered="offered" :coach-options="coaches" :target-name="visit.target.name ?? ''" :errors="errors" />
              </template>
            </DlRecordSection>

            <DlRecordSection v-bind="section('advs')" :title="t('visits.blocks.advsN', { n: n(visit.advs?.length ?? 0) })" icon="tabler-presentation" class="bg-dl-paper" @update:editing="edit('advs')" @save="save" @cancel="editing = null">
              <ul class="flex flex-col text-[13.5px]">
                <li v-for="adv in visit.advs" :key="adv.id" class="flex items-center gap-3 border-b border-dl-line-soft py-2 last:border-0">
                  <span class="min-w-0 flex-1"><strong class="font-semibold">{{ adv.name }}</strong><small class="block text-xs text-dl-muted">{{ [t(`advs.type.${adv.type}`), adv.brand].filter(Boolean).join(' · ') }}</small></span>
                  <span v-if="adv.feedback" class="font-bold">{{ adv.feedback }}<small class="font-normal text-dl-muted"> / 5</small></span>
                </li>
              </ul>
              <p v-if="!visit.advs?.length" class="text-[13px] text-dl-muted">{{ t('visits.advs.noneShown') }}</p>
              <template #edit>
                <VisitReportFields v-model="report" part="advs" :brand-options="brands" :stock="stock" :offered="offered" :coach-options="coaches" :target-name="visit.target.name ?? ''" :errors="errors" />
              </template>
            </DlRecordSection>

            <DlRecordSection v-bind="section('notes')" :title="t('visits.blocks.notes')" icon="tabler-notes" class="bg-dl-paper" @update:editing="edit('notes')" @save="save" @cancel="editing = null">
              <dl class="grid grid-cols-[140px_1fr] gap-x-2.5 gap-y-2 text-[13.5px]">
                <dt class="text-dl-muted">{{ t('visits.fields.objective') }}</dt><dd>{{ visit.objective || '—' }}</dd>
                <dt class="text-dl-muted">{{ t('visits.fields.nextObjective') }}</dt><dd>{{ visit.next_objective || '—' }}</dd>
                <dt class="text-dl-muted">{{ t('visits.fields.comment') }}</dt><dd class="whitespace-pre-line">{{ visit.comment || '—' }}</dd>
              </dl>
              <template #edit>
                <div class="flex flex-col gap-3">
                  <DlInput v-model="form.objective" :label="t('visits.fields.objective')" :error="errors.objective" />
                  <DlInput v-model="form.next_objective" :label="t('visits.fields.nextObjective')" :error="errors.next_objective" />
                  <DlTextarea v-model="form.comment" :label="t('visits.fields.comment')" :rows="3" />
                </div>
              </template>
            </DlRecordSection>
          </template>

          <template v-else>
            <section class="rounded-3xl bg-dl-paper px-5 py-8 text-center text-[13.5px] text-dl-muted">
              <strong class="mb-1 block text-dl-fg">{{ t('visits.report.none') }}</strong>{{ t('visits.report.noneText') }}
            </section>
            <section class="flex flex-col gap-1.5 rounded-3xl bg-dl-paper p-4 text-[13.5px] md:p-5">
              <h2 class="text-sm font-bold">{{ t('visits.fields.objectivePlanned') }}</h2>
              <p>{{ visit.objective || '—' }}</p>
            </section>
          </template>
        </div>

        <aside class="flex w-full shrink-0 flex-col gap-4 lg:w-[380px]">
          <DlRecordSection v-bind="section('visit')" :title="t('visits.blocks.visit')" icon="tabler-map-pin" class="bg-dl-paper" @update:editing="edit('visit')" @save="save" @cancel="editing = null">
            <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-2 text-[13.5px]">
              <dt class="text-dl-muted">{{ t(isDone ? 'visits.fields.day' : 'visits.fields.dayPlanned') }}</dt>
              <dd class="first-letter:uppercase">{{ text.dayLong(visit.visit_date) }}<template v-if="visit.visit_time"> · {{ visit.visit_time }}</template></dd>
              <dt class="text-dl-muted">{{ t('visits.fields.person') }}</dt>
              <dd>{{ visit.user?.full_name ?? '—' }}<small class="block text-xs text-dl-muted">{{ [roleLabel(visit.user?.role), visit.user?.team].filter(Boolean).join(' · ') }}</small></dd>
              <dt class="text-dl-muted">{{ t('visits.fields.canal') }}</dt><dd>{{ visit.canal?.name ?? '—' }}</dd>
              <dt class="text-dl-muted">{{ t('visits.fields.cycle') }}</dt>
              <dd>
                <template v-if="visit.cycle">
                  <RouterLink v-if="auth.can('cycles.show')" :to="{ name: 'tenant-cycle-detail', params: { id: visit.cycle.id } }" class="text-dl-cobalt no-underline hover:underline">{{ t('visits.cyclePeriod', { from: text.date(visit.cycle.start_date), to: text.date(visit.cycle.end_date) }) }}</RouterLink>
                  <template v-else>{{ t('visits.cyclePeriod', { from: text.date(visit.cycle.start_date), to: text.date(visit.cycle.end_date) }) }}</template>
                  <small class="block text-xs text-dl-muted">{{ visit.cycle.to_do != null ? t('visits.cyclePlace', { done: visit.cycle.done ?? 0, toDo: visit.cycle.to_do }) : t('visits.offListShort') }}</small>
                </template>
                <template v-else>{{ t('visits.noCycle') }}</template>
              </dd>
            </dl>
            <template #edit>
              <div class="flex flex-col gap-3">
                <DlInput v-model="form.date" type="date" :label="t('visits.fields.day')" :error="errors.visit_date" />
                <DlInput v-model="form.time" type="time" :label="t('visits.fields.timeOptional')" :error="errors.visit_time" />
                <DlSelect v-model="canalModel" :label="t('visits.fields.canal')" :options="canals" />
                <DlInput v-if="!isDone" v-model="form.objective" :label="t('visits.fields.objectiveOptional')" />
                <span v-if="errors.status" class="text-xs text-dl-rejected">{{ errors.status }}</span>
              </div>
            </template>
          </DlRecordSection>

          <DlRecordSection v-if="isDone" v-bind="section('people')" :title="t('visits.blocks.people')" icon="tabler-users" class="bg-dl-paper" @update:editing="edit('people')" @save="save" @cancel="editing = null">
            <dl class="grid grid-cols-[130px_1fr] gap-x-2.5 gap-y-2 text-[13.5px]">
              <dt class="text-dl-muted">{{ t('visits.fields.coaches') }}</dt>
              <dd><span v-for="person in visit.coaches" :key="person.id" class="block">{{ person.full_name }} <small class="text-xs text-dl-muted">· {{ roleLabel(person.role) }}</small></span><template v-if="!visit.coaches?.length">—</template></dd>
              <dt class="text-dl-muted">{{ t('visits.fields.participants') }}</dt>
              <dd><span v-for="person in visit.participants" :key="person.id" class="block">{{ person.name }}</span><template v-if="!visit.participants?.length">—</template></dd>
              <dt class="text-dl-muted">{{ t('visits.people.replacementSeen') }}</dt><dd>{{ visit.replacement?.name ?? t('visits.people.no') }}</dd>
            </dl>
            <template #edit>
              <VisitReportFields v-model="report" v-model:replacing="replacing" part="people" :brand-options="brands" :stock="stock" :offered="offered" :coach-options="coaches" :target-name="visit.target.name ?? ''" :errors="errors" />
            </template>
          </DlRecordSection>

          <section class="flex flex-col gap-2.5 rounded-3xl bg-dl-paper p-4 text-[13.5px] md:p-5">
            <h2 class="text-sm font-bold">{{ t('visits.page.around') }}</h2>
            <div v-for="[key, other] in around" :key="key" class="flex flex-col">
              <span class="text-xs text-dl-muted">{{ t(`visits.page.${key}`) }}</span>
              <template v-if="other">
                <RouterLink :to="{ name: 'tenant-visit-detail', params: { id: other.id } }" class="text-dl-cobalt no-underline hover:underline">{{ text.date(other.visit_date) }}<template v-if="other.status === 'planned'"> · {{ t('visits.state.planned') }}</template></RouterLink>
                <span v-if="other.brands.length">{{ text.brands(other) }}</span>
                <small v-if="key === 'previous' && other.next_objective" class="text-xs text-dl-muted">{{ t('visits.form.lastNext', { text: other.next_objective }) }}</small>
              </template>
              <span v-else>{{ t(`visits.page.${key}None`) }}</span>
            </div>
          </section>

          <p class="px-1 text-xs text-dl-muted">
            {{ visit.created_by && visit.created_by.id !== visit.user?.id
              ? t('visits.page.addedFor', { by: visit.created_by.full_name, name: visit.user?.full_name ?? '', date: text.date(visit.created_at) })
              : t('visits.page.addedBy', { name: visit.created_by?.full_name ?? '—', date: text.date(visit.created_at) }) }}
          </p>
        </aside>
      </div>

      <VisitCancelSheet v-model:open="cancelling" :visit="visit" @cancelled="updated => (visit = updated)" />
      <VisitReopenSheet v-model:open="reopening" :visit="visit" @opened="load" />
      <VisitNoteSheet v-model:open="rejecting" :title="t('visits.approval.rejectVisit')" :description="`${visit.target.name ?? ''} · ${text.dayLong(visit.visit_date)}`" :label="t('visits.approval.note')" :confirm-label="t('visits.approval.rejectVisit')" :run="rejectIt" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fieldErrors } from '@/api/errors'
import { createVisit, fetchVisit, fetchVisitContext, fetchVisitPeople, updateVisit, type Visit, type VisitContext, type VisitOfferedAdv, type VisitPerson, type VisitTargetType } from '@/api/tenant/visits'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { todayIso, useVisitText } from './visitDisplay'
import VisitReportFields from './VisitReportFields.vue'
import VisitTargetSearch, { type FoundTarget } from './VisitTargetSearch.vue'
import { emptyReport, givesStock, offeredAdvs, reportOf, reportPayload, useVisitLookups } from './useVisitForm'
import { usePlanningSave } from './visitPlanning'

// "Ajouter une visite": one page, one save. The visit on top (who, which day, canal, planned or done), then the
// report blocks when it is done; the summary stays at the side. With an id it is "Saisir le compte rendu" of a
// planned visit: the same page, already filled. Mockup: docs/design/visits-mockups/Visits.html (frames 5–6)
const props = defineProps<{ id?: string }>()
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const text = useVisitText()
const { brands, canals, coaches } = useVisitLookups()
const planning = usePlanningSave()

const reporting = computed(() => !!props.id)
const loading = ref(reporting.value)
const existing = ref<Visit | null>(null)
const people = ref<VisitPerson[]>([])
onMountedAndFocus(async () => { people.value = await fetchVisitPeople().catch(() => []) })

const form = reactive({
  user_id: auth.user?.id ?? null as number | null,
  type: 'hcp' as VisitTargetType,
  target: null as FoundTarget | null,
  date: todayIso(),
  time: '',
  canal_id: null as number | null,
  status: 'done' as 'planned' | 'done',
  objective: '',
  next_objective: '',
  comment: '',
})
const report = ref(emptyReport())
const replacing = ref(false)
const errors = ref<Record<string, string>>({})
const saving = ref(false)

const future = computed(() => form.date > todayIso())
watch(future, isFuture => { if (isFuture) form.status = 'planned' }, { immediate: true })
const done = computed(() => form.status === 'done')
const statusItems = computed(() => [{ value: 'planned', label: t('visits.state.planned') }, { value: 'done', label: t('visits.state.done') }])
const typeItems = computed(() => [{ value: 'hcp', label: t('visits.target.hcp') }, { value: 'hco', label: t('visits.target.hco') }])
const personOptions = computed(() => people.value.map(person => ({ value: person.id, label: [person.full_name, roleLabel(person.role), person.team].filter(Boolean).join(' · ') })))
const personName = computed(() => people.value.find(person => person.id === form.user_id)?.full_name ?? auth.user?.name ?? '')
const userModel = computed({ get: () => form.user_id, set: value => { form.user_id = value == null ? null : Number(value) } })
const canalModel = computed({ get: () => form.canal_id, set: value => { form.canal_id = value == null ? null : Number(value) } })
const stock = computed(() => !!form.target && givesStock(form.type, form.target.kind))

// What the summary shows: the cycle found, off-list, the last visit, a visit already there that day.
const context = ref<VisitContext | null>(null)
const query = computed(() => (form.target && form.user_id && form.date ? { user_id: form.user_id, visitable_type: form.type, visitable_id: form.target.id, date: form.date } : null))
watch(query, async (value) => {
  context.value = value ? await fetchVisitContext(value).catch(() => null) : null
}, { immediate: true })
const sameDay = computed(() => (context.value?.same_day_visit_id && context.value.same_day_visit_id !== existing.value?.id ? context.value.same_day_visit_id : null))

// The ADVs offered follow the brands chosen.
const offered = ref<VisitOfferedAdv[]>([])
watch([query, () => report.value.brands.map(row => row.brand_id).join(','), done], async () => {
  offered.value = query.value && done.value ? await offeredAdvs(query.value, report.value, offered.value).catch(() => []) : []
})

async function load() {
  if (!props.id) return
  try {
    const visit = await fetchVisit(Number(props.id))
    if (visit.status !== 'planned') {
      router.replace({ name: 'tenant-visit-detail', params: { id: visit.id } })
      return
    }
    existing.value = visit
    Object.assign(form, {
      user_id: visit.user?.id ?? null, type: visit.target.type,
      target: { id: visit.target.id, name: visit.target.name ?? '', hint: text.where(visit.target), kind: visit.target.kind },
      // A report is entered for the day planned, or today when that day is still to come.
      date: visit.visit_date > todayIso() ? todayIso() : visit.visit_date,
      time: visit.visit_time ?? '', canal_id: visit.canal?.id ?? null, status: 'done',
      objective: visit.objective ?? '', next_objective: visit.next_objective ?? '', comment: '',
    })
    report.value = reportOf(visit)
  }
  finally {
    loading.value = false
  }
}
load()

function pickTarget(target: FoundTarget) {
  form.target = target
  errors.value = {}
}
watch(() => form.type, () => { if (!existing.value) form.target = null })

async function save() {
  errors.value = {}
  if (!form.target) errors.value.visitable_id = t('visits.form.pickTarget')
  // A planned visit may leave the canal empty: the lab's default is given (docs/api/visit-planning.md).
  if (!form.canal_id && done.value) errors.value.canal_id = t('visits.form.pickCanal')
  if (done.value && !report.value.brands.length) errors.value.brands = t('visits.form.pickBrand')
  if (Object.keys(errors.value).length || !form.target) return

  const payload = {
    user_id: form.user_id ?? undefined, visitable_type: form.type, visitable_id: form.target.id,
    visit_date: form.date, visit_time: form.time || null, canal_id: form.canal_id ?? undefined, status: form.status,
    objective: form.objective.trim() || null,
    ...(done.value ? { next_objective: form.next_objective.trim() || null, comment: form.comment.trim() || null, ...reportPayload(report.value) } : {}),
  }
  saving.value = true
  const id = existing.value?.id
  // Planning answers are handled the same way everywhere: a weekend asks to confirm, a refusal shows on the day.
  const visit = await planning.save(body => (id ? updateVisit(id, body) : createVisit(body)), payload, (error) => {
    errors.value = fieldErrors(error)
    return Object.keys(errors.value).length > 0
  })
  saving.value = false
  if (!visit) return
  toast.success(t(done.value ? 'visits.toast.saved' : 'visits.toast.planned'))
  router.push({ name: 'tenant-visit-detail', params: { id: visit.id } })
}
const backTo = computed(() => (existing.value ? { name: 'tenant-visit-detail', params: { id: existing.value.id } } : { name: 'tenant-visits' }))
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex min-w-0 flex-col gap-1.5">
      <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
        <RouterLink :to="{ name: 'tenant-visits' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('visits.title') }}</RouterLink>
        <span aria-hidden="true">›</span><span>{{ t(reporting ? 'visits.report.title' : 'visits.add.title') }}</span>
      </nav>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[36px]">{{ t(reporting ? 'visits.report.title' : 'visits.add.title') }}</h1>
      <p class="text-sm text-dl-muted">{{ t(reporting ? 'visits.report.hint' : 'visits.add.hint') }}</p>
    </div>

    <div v-if="loading" class="flex flex-col gap-4"><DlSkeleton v-for="i in 3" :key="i" class="h-40 rounded-3xl" /></div>
    <form v-else class="flex items-start gap-5 max-lg:flex-col" @submit.prevent="save">
      <div class="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
        <section class="flex flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-5">
          <h2 class="text-base font-semibold">{{ t('visits.blocks.visit') }}</h2>
          <div v-if="people.length > 1 && !existing" class="sm:max-w-md">
            <DlSelect v-model="userModel" :label="t('visits.fields.person')" :options="personOptions" />
            <span class="mt-1 block text-xs text-dl-muted">{{ t('visits.form.personHint') }}</span>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-[13px] font-semibold">{{ t('visits.form.who') }}</span>
            <DlSegmented v-if="!existing" v-model="form.type" :label="t('visits.form.who')" :items="typeItems" class="self-start" />
            <div v-if="form.target" class="flex items-center gap-2.5 rounded-2xl border border-dl-line px-3 py-2.5 text-[13.5px]">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dl-mist text-xs font-bold">{{ text.initials(form.target.name) }}</span>
              <span class="min-w-0 flex-1">
                <strong class="font-semibold">{{ form.target.name }}</strong>
                <DlBadge v-if="context?.off_list" size="sm" tone="warning" class="ms-1.5">{{ t('visits.offList') }}</DlBadge>
                <small class="block text-xs text-dl-muted">{{ form.target.hint }}</small>
              </span>
              <DlButton v-if="!existing" variant="ghost" size="sm" @click="form.target = null">{{ t('visits.form.change') }}</DlButton>
            </div>
            <VisitTargetSearch v-else :type="form.type" :label="t('visits.form.who')" :error="errors.visitable_id" @pick="pickTarget" />
            <p v-if="form.target && context?.off_list" class="rounded-xl bg-dl-pending/8 px-3 py-2.5 text-xs text-dl-pending">
              <strong>{{ t('visits.offList') }}.</strong> {{ t(context.cycle ? 'visits.form.offListText' : 'visits.form.noCycleText') }}
            </p>
            <p v-if="sameDay" class="rounded-xl bg-dl-rejected/8 px-3 py-2.5 text-xs text-dl-rejected">
              {{ t('visits.form.sameDay') }}
              <RouterLink :to="{ name: 'tenant-visit-detail', params: { id: sameDay } }" class="font-semibold text-dl-rejected underline">{{ t('visits.form.openIt') }}</RouterLink>
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-[1fr_150px_1fr]">
            <DlInput v-model="form.date" type="date" :label="t('visits.fields.day')" :error="errors.visit_date" />
            <DlInput v-model="form.time" type="time" :label="t('visits.fields.timeOptional')" :error="errors.visit_time" />
            <DlSelect v-model="canalModel" :label="t('visits.fields.canal')" :options="canals" :placeholder="t('visits.form.pickCanal')" />
          </div>
          <span v-if="errors.canal_id" class="-mt-2 text-xs text-dl-rejected">{{ errors.canal_id }}</span>

          <div v-if="!reporting" class="flex flex-col gap-1.5">
            <span class="text-[13px] font-semibold">{{ t('visits.form.status') }}</span>
            <DlSegmented v-if="!future" v-model="form.status" :label="t('visits.form.status')" :items="statusItems" class="self-start" />
            <span class="text-xs text-dl-muted">{{ t(future ? 'visits.form.futureHint' : done ? 'visits.form.doneHint' : 'visits.form.plannedHint') }}</span>
            <span v-if="errors.status" class="text-xs text-dl-rejected">{{ errors.status }}</span>
          </div>
          <DlInput v-model="form.objective" :label="t('visits.fields.objectiveOptional')" :error="errors.objective" />
        </section>

        <template v-if="done">
          <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
            <h2 class="text-base font-semibold">{{ t('visits.blocks.brands') }}</h2>
            <VisitReportFields v-model="report" part="brands" :brand-options="brands" :stock="stock" :offered="offered" :coach-options="coaches" :target-name="form.target?.name ?? ''" :errors="errors" />
          </section>
          <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
            <h2 class="text-base font-semibold">{{ t('visits.blocks.advs') }} <small class="font-normal text-dl-muted">· {{ t('visits.optional') }}</small></h2>
            <VisitReportFields v-model="report" part="advs" :brand-options="brands" :stock="stock" :offered="offered" :coach-options="coaches" :target-name="form.target?.name ?? ''" :errors="errors" />
          </section>
          <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
            <h2 class="text-base font-semibold">{{ t('visits.blocks.people') }} <small class="font-normal text-dl-muted">· {{ t('visits.optional') }}</small></h2>
            <VisitReportFields v-model="report" v-model:replacing="replacing" part="people" :brand-options="brands" :stock="stock" :offered="offered" :coach-options="coaches" :target-name="form.target?.name ?? ''" :errors="errors" />
          </section>
          <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
            <h2 class="text-base font-semibold">{{ t('visits.blocks.notes') }} <small class="font-normal text-dl-muted">· {{ t('visits.optional') }}</small></h2>
            <DlInput v-model="form.next_objective" :label="t('visits.fields.nextObjective')" :error="errors.next_objective" />
            <DlTextarea v-model="form.comment" :label="t('visits.fields.comment')" :rows="3" />
          </section>
        </template>
        <p v-else class="rounded-2xl bg-dl-mist px-4 py-4 text-center text-[13px] text-dl-muted">{{ t('visits.form.reportLater') }}</p>
      </div>

      <aside class="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-4 lg:w-[360px]">
        <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
          <h2 class="text-base font-semibold">{{ t('visits.form.summary') }}</h2>
          <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-2 text-[13.5px]">
            <dt class="text-dl-muted">{{ t('visits.fields.person') }}</dt><dd>{{ personName || '—' }}</dd>
            <dt class="text-dl-muted">{{ t(`visits.target.${form.type}Short`) }}</dt><dd>{{ form.target?.name ?? '—' }}</dd>
            <dt class="text-dl-muted">{{ t('visits.fields.day') }}</dt><dd class="first-letter:uppercase">{{ text.day(form.date) }}<template v-if="form.time"> · {{ form.time }}</template></dd>
            <dt class="text-dl-muted">{{ t('visits.fields.cycle') }}</dt>
            <dd>
              <template v-if="context?.cycle">{{ t('visits.cyclePeriod', { from: text.date(context.cycle.start_date), to: text.date(context.cycle.end_date) }) }}</template>
              <template v-else>{{ form.target ? t('visits.noCycle') : '—' }}</template>
              <small v-if="context?.cycle?.to_do != null" class="block text-xs text-dl-muted">{{ t('visits.cyclePlace', { done: context.cycle.done ?? 0, toDo: context.cycle.to_do }) }}</small>
            </dd>
            <dt class="text-dl-muted">{{ t('visits.columns.state') }}</dt><dd><DlBadge size="sm" :tone="done ? 'success' : 'info'" dot>{{ t(`visits.state.${form.status}`) }}</DlBadge></dd>
            <template v-if="done">
              <dt class="text-dl-muted">{{ t('visits.blocks.brands') }}</dt><dd>{{ report.brands.length }}</dd>
              <dt class="text-dl-muted">{{ t('visits.blocks.advs') }}</dt><dd>{{ report.advs.length }}</dd>
            </template>
          </dl>
          <DlButton type="submit" variant="primary" block :loading="saving" :disabled="!!sameDay">{{ t(done ? 'visits.form.save' : 'visits.form.plan') }}</DlButton>
          <DlButton variant="outline" block :to="backTo">{{ t('common.actions.cancel') }}</DlButton>
        </section>
        <section v-if="form.target" class="flex flex-col gap-1.5 rounded-3xl bg-dl-paper p-4 text-[13.5px] md:p-5">
          <h2 class="text-base font-semibold">{{ t('visits.form.lastVisit') }}</h2>
          <template v-if="context?.last_visit">
            <RouterLink :to="{ name: 'tenant-visit-detail', params: { id: context.last_visit.id } }" class="text-dl-cobalt no-underline hover:underline">{{ text.date(context.last_visit.visit_date) }}</RouterLink>
            <span>{{ text.brands(context.last_visit) }}</span>
            <small v-if="context.last_visit.next_objective" class="text-xs text-dl-muted">{{ t('visits.form.lastNext', { text: context.last_visit.next_objective }) }}</small>
          </template>
          <span v-else class="text-dl-muted">{{ t('visits.form.noLastVisit') }}</span>
        </section>
      </aside>
    </form>
  </div>
</template>

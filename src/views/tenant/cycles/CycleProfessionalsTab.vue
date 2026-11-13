<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { fetchSegmentations, type Segmentation } from '@/api/tenant/customerSetup'
import {
  fetchCycleProfessionals,
  removeCycleProfessionals,
  setCycleSegment,
  type CycleDetail,
  type CycleProfessional,
  type CycleProState,
} from '@/api/tenant/cycles'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { PRO_STATE_TONE, useCycleText } from './cycleDisplay'

// The cycle's professionals: segment changed in the row (or for many picked rows), visits to do
// (Frequencies), done, planned and a state (done and planned come with visits). Mockup: docs/design/plan-mockups/Cycles.html (frame 6)
const props = defineProps<{ cycle: CycleDetail }>()
const emit = defineEmits<{ changed: []; add: []; check: [] }>()
const { t, n } = useI18n()
const text = useCycleText()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const segments = ref<Segmentation[]>([])
fetchSegmentations({ per_page: 100, sort: 'position', 'filter[type]': 'cycle_target' }).then(page => { segments.value = page.items })

const ALL = 'all'
const NONE = 'none'
const filters = reactive({ q: '', kind: ALL, segment: ALL as string | number, state: ALL as string })
const page = ref(1)
const perPage = ref(25)
const rows = ref<CycleProfessional[]>([])
const total = ref(0)
const states = ref<Partial<Record<CycleProState, number>>>({})
const loading = ref(true)
const picked = ref(new Set<number>())

let request = 0
async function load() {
  const mine = ++request
  loading.value = true
  try {
    const body = await fetchCycleProfessionals(props.cycle.id, {
      page: page.value,
      per_page: perPage.value,
      q: filters.q.trim() || undefined,
      kind: filters.kind === ALL ? undefined : filters.kind,
      segment: filters.segment === ALL ? undefined : filters.segment === NONE ? 'none' : Number(filters.segment),
      state: filters.state === ALL ? undefined : filters.state as CycleProState,
    })
    if (mine !== request) return
    rows.value = body.data
    total.value = body.meta.total
    states.value = body.meta.states ?? {}
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    if (mine === request) loading.value = false
  }
}
watch(() => ({ ...filters }), () => { page.value = 1; picked.value = new Set() }, { deep: true })
watch([() => props.cycle.id, page, perPage, () => ({ ...filters })], load, { immediate: true, deep: true })
defineExpose({ reload: load })

const kindOptions = computed(() => [
  { value: ALL, label: t('cycles.pros.allKinds') },
  ...(props.cycle.user?.role?.visits ?? []).map(kind => ({ value: kind, label: text.kind(kind) })),
])
const segmentItems = computed(() => [...segments.value].sort((a, b) => a.position - b.position))
const segmentFilter = computed(() => [
  { value: ALL, label: t('cycles.pros.allSegments') },
  ...segmentItems.value.map(segment => ({ value: segment.id, label: segment.name })),
  { value: NONE, label: t('cycles.segment.none') },
])
const segmentChoices = computed(() => [
  { value: NONE, label: t('cycles.segment.set') },
  ...segmentItems.value.map(segment => ({ value: segment.id, label: segment.name })),
])
// Until visits, only these three can happen; started, reached and over come with visits.
const STATES: CycleProState[] = ['not_seen', 'started', 'reached', 'over', 'no_segment', 'none_needed']
const stateOptions = computed(() => [{ value: ALL, label: t('cycles.pros.allStates') }, ...STATES.map(state => ({ value: state, label: t(`cycles.pros.state.${state}`) }))])

const editable = computed(() => canUpdate('cycles'))
const saving = ref(false)
async function setSegment(targetIds: number[], value: string | number) {
  saving.value = true
  try {
    await setCycleSegment(props.cycle.id, { target_ids: targetIds, segmentation_id: value === NONE ? null : Number(value) })
    toast.success(t('cycles.pros.segmentSaved', targetIds.length))
    picked.value = new Set()
    await load()
    emit('changed')
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
async function remove(targetIds: number[]) {
  const ok = await confirm({
    title: t('cycles.pros.removeTitle', targetIds.length),
    text: t('cycles.pros.removeText'),
    confirmButtonText: t('cycles.pros.remove'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await removeCycleProfessionals(props.cycle.id, targetIds)
    toast.success(t('cycles.pros.removed', targetIds.length))
    picked.value = new Set()
    await load()
    emit('changed')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

function toggle(id: number) {
  const next = new Set(picked.value)
  next.has(id) ? next.delete(id) : next.add(id)
  picked.value = next
}
const allPicked = computed(() => rows.value.length > 0 && rows.value.every(row => picked.value.has(row.id)))
function toggleAll() {
  picked.value = allPicked.value ? new Set() : new Set(rows.value.map(row => row.id))
}
const bulkSegment = ref<string | number>(NONE)

function stateLabel(row: CycleProfessional) {
  return row.state === 'over' ? t('cycles.pros.over', { n: n(row.done - row.to_do) }) : t(`cycles.pros.state.${row.state}`)
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
    <div class="flex flex-wrap items-center gap-2.5">
      <DlInput v-model="filters.q" type="search" icon="tabler-search" :label="t('cycles.pros.search')" :placeholder="t('cycles.pros.search')" hide-label class="w-full sm:max-w-56" />
      <DlSelect v-model="filters.kind" :label="t('cycles.pros.kind')" :options="kindOptions" appearance="filter" />
      <DlSelect v-model="filters.segment" :label="t('cycles.pros.segment')" :options="segmentFilter" appearance="filter" />
      <DlSelect v-model="filters.state" :label="t('cycles.pros.stateLabel')" :options="stateOptions" appearance="filter" />
      <button
        v-if="states.no_segment"
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-[11px] border px-3 text-[13px] font-semibold"
        :class="filters.segment === NONE ? 'border-dl-fg bg-dl-signal-soft text-dl-fg' : 'border-dl-line bg-dl-paper text-dl-body'"
        :aria-pressed="filters.segment === NONE"
        @click="filters.segment = filters.segment === NONE ? ALL : NONE"
      >
        <i class="h-2 w-2 rounded-full bg-dl-pending" />{{ t('cycles.segment.none') }} <b class="text-dl-fg">{{ n(states.no_segment) }}</b>
      </button>
      <span v-if="editable" class="ms-auto flex gap-2">
        <DlButton variant="outline" size="sm" icon="tabler-refresh" @click="emit('check')">{{ t('cycles.check.button') }}</DlButton>
        <DlButton variant="primary" size="sm" icon="tabler-plus" @click="emit('add')">{{ t('cycles.add.button') }}</DlButton>
      </span>
    </div>

    <div v-if="editable && picked.size" class="flex flex-wrap items-center gap-2.5 rounded-2xl bg-dl-signal-soft px-3.5 py-2.5 text-[13px]">
      <b>{{ t('cycles.pros.picked', picked.size) }}</b>
      <span class="ms-2 w-44"><DlSelect v-model="bulkSegment" :label="t('cycles.pros.segment')" :options="segmentChoices" hide-label /></span>
      <DlButton variant="dark" size="sm" :loading="saving" @click="setSegment([...picked], bulkSegment)">{{ t('cycles.pros.setSegment') }}</DlButton>
      <DlButton variant="outline" size="sm" icon="tabler-trash" class="ms-auto" @click="remove([...picked])">{{ t('cycles.pros.remove') }}</DlButton>
    </div>

    <div v-if="loading && !rows.length" class="flex flex-col gap-2"><DlSkeleton v-for="i in 5" :key="i" class="h-12 rounded-xl" /></div>
    <p v-else-if="!rows.length" class="py-8 text-center text-sm text-dl-muted">{{ t('cycles.pros.empty') }}</p>
    <div v-else class="overflow-x-auto" :class="loading && 'opacity-60'">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="text-xs text-dl-muted">
            <th v-if="editable" class="w-8 border-b border-dl-line px-2 py-2.5"><input type="checkbox" class="h-[18px] w-[18px] accent-dl-ink" :checked="allPicked" :aria-label="t('cycles.create.pickAll')" @change="toggleAll"></th>
            <th class="border-b border-dl-line px-2 py-2.5 text-start font-semibold">{{ t('cycles.pros.professional') }}</th>
            <th class="border-b border-dl-line px-2 py-2.5 text-start font-semibold max-md:hidden">{{ t('cycles.pros.commune') }}</th>
            <th class="border-b border-dl-line px-2 py-2.5 text-start font-semibold">{{ t('cycles.pros.segment') }}</th>
            <th class="border-b border-dl-line px-2 py-2.5 text-end font-semibold">{{ t('cycles.pros.toDo') }}</th>
            <th class="border-b border-dl-line px-2 py-2.5 text-end font-semibold">{{ t('cycles.pros.done') }}</th>
            <th class="border-b border-dl-line px-2 py-2.5 text-end font-semibold max-md:hidden">{{ t('cycles.pros.planned') }}</th>
            <th class="border-b border-dl-line px-2 py-2.5 text-start font-semibold">{{ t('cycles.pros.stateLabel') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" class="border-b border-dl-line-soft" :class="picked.has(row.id) && 'bg-dl-signal-soft'">
            <td v-if="editable" class="px-2 py-2"><input type="checkbox" class="h-[18px] w-[18px] accent-dl-ink" :checked="picked.has(row.id)" :aria-label="row.hcp.name" @change="toggle(row.id)"></td>
            <td class="px-2 py-2">
              <RouterLink :to="{ name: 'tenant-hcp-detail', params: { id: row.hcp.id } }" class="font-semibold text-dl-fg no-underline hover:underline">{{ row.hcp.name }}</RouterLink>
              <small class="block text-xs text-dl-muted">{{ [text.kind(row.hcp.type), ...row.hcp.specialities].join(' · ') }}</small>
            </td>
            <td class="px-2 py-2 max-md:hidden">{{ row.hcp.commune ?? '—' }}</td>
            <td class="w-36 px-2 py-2">
              <DlSelect
                v-if="editable"
                :model-value="row.segment?.id ?? NONE"
                :label="t('cycles.pros.segmentOf', { name: row.hcp.name })"
                :options="segmentChoices"
                hide-label
                :class="!row.segment && 'text-dl-pending'"
                @update:model-value="value => setSegment([row.id], value as string | number)"
              />
              <span v-else-if="row.segment" class="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"><i class="h-[9px] w-[9px] rounded-[3px]" :style="{ background: row.segment.color ?? undefined }" />{{ row.segment.name }}</span>
              <span v-else class="text-[12.5px] text-dl-pending">{{ t('cycles.segment.none') }}</span>
            </td>
            <td class="px-2 py-2 text-end tabular-nums">{{ row.to_do || '—' }}</td>
            <td class="px-2 py-2 text-end tabular-nums">{{ n(row.done) }}</td>
            <td class="px-2 py-2 text-end tabular-nums text-dl-muted max-md:hidden">{{ n(row.planned) }}</td>
            <td class="px-2 py-2"><DlBadge size="sm" :tone="PRO_STATE_TONE[row.state]">{{ stateLabel(row) }}</DlBadge></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="editable && rows.length" class="text-xs text-dl-muted">{{ t('cycles.pros.hint') }}</p>
    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { addCycleProfessionals, fetchAvailableProfessionals, type AvailableProfessional, type CycleDetail } from '@/api/tenant/cycles'
import { fetchSegmentations, fetchSpecialities, type Segmentation, type Speciality } from '@/api/tenant/customerSetup'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useToast } from '@/composables/useToast'
import { useCycleText } from './cycleDisplay'

// "Add professionals" to a cycle: from the person's territory first; "Search everyone" for someone
// outside it (allowed, with a note). Mockup: docs/design/plan-mockups/Cycles.html (frame 7)
const props = defineProps<{ cycle: CycleDetail }>()
const emit = defineEmits<{ added: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const text = useCycleText()
const toast = useToast()
const segments = ref<Segmentation[]>([])
const specialities = ref<Speciality[]>([])
fetchSegmentations({ per_page: 100, sort: 'position', 'filter[type]': 'cycle_target' }).then(page => { segments.value = page.items })
fetchSpecialities({ per_page: 100, sort: 'name' }).then(page => { specialities.value = page.items })

const ALL = 'all'
const NONE = 'none'
const scope = ref<'territory' | 'all'>('territory')
const filters = reactive({ q: '', type: ALL, speciality: ALL as string | number })
const rows = ref<AvailableProfessional[]>([])
const total = ref(0)
const territoryCount = ref(0)
const page = ref(1)
const loading = ref(false)
const picked = ref(new Map<number, AvailableProfessional>())
const segment = ref<string | number>(NONE)
const saving = ref(false)

let request = 0
async function load(more = false) {
  const mine = ++request
  loading.value = true
  page.value = more ? page.value + 1 : 1
  try {
    const body = await fetchAvailableProfessionals(props.cycle.id, {
      scope: scope.value,
      page: page.value,
      per_page: 20,
      q: filters.q.trim() || undefined,
      type: filters.type === ALL ? undefined : filters.type,
      speciality_id: filters.speciality === ALL ? undefined : Number(filters.speciality),
    })
    if (mine !== request) return
    rows.value = more ? [...rows.value, ...body.data] : body.data
    total.value = body.meta.total
    territoryCount.value = body.meta.territory_count
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    if (mine === request) loading.value = false
  }
}
watch([scope, () => ({ ...filters })], () => load(), { immediate: true, deep: true })

const scopeItems = computed(() => [
  { value: 'territory', label: t('cycles.add.inTerritory', { n: n(territoryCount.value) }) },
  { value: 'all', label: t('cycles.add.everyone') },
])
const kinds = computed(() => props.cycle.user?.role?.visits ?? [])
const kindOptions = computed(() => [{ value: ALL, label: t('cycles.pros.allKinds') }, ...(scope.value === 'all' ? ['doctor', 'dentiste', 'pharmacie', 'wholestore', 'distributor'] : kinds.value).map(kind => ({ value: kind, label: text.kind(kind) }))])
const specialityOptions = computed(() => [{ value: ALL, label: t('cycles.add.allSpecialities') }, ...specialities.value.map(item => ({ value: item.id, label: item.name })).sort((a, b) => a.label.localeCompare(b.label))])
const segmentOptions = computed(() => [
  { value: NONE, label: t('cycles.segment.none') },
  ...[...segments.value].sort((a, b) => a.position - b.position).map(item => ({ value: item.id, label: item.name })),
])
const outside = computed(() => [...picked.value.values()].some(row => !row.in_territory))

function toggle(row: AvailableProfessional) {
  const next = new Map(picked.value)
  next.has(row.id) ? next.delete(row.id) : next.set(row.id, row)
  picked.value = next
}

async function save() {
  saving.value = true
  try {
    const body = await addCycleProfessionals(props.cycle.id, { hcp_ids: [...picked.value.keys()], segmentation_id: segment.value === NONE ? null : Number(segment.value) })
    toast.success(t('cycles.add.done', body.added))
    picked.value = new Map()
    emit('added')
    load()
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('cycles.add.title')" :description="t('cycles.add.to', { name: cycle.user?.full_name ?? '', period: text.period(cycle.start_date, cycle.end_date) })">
    <div class="flex flex-col gap-3.5">
      <DlSegmented v-model="scope" :label="t('cycles.add.title')" :items="scopeItems" block />
      <p class="rounded-xl bg-dl-mist px-3 py-2 text-[12.5px] text-dl-body">
        {{ scope === 'territory'
          ? t('cycles.add.territoryWhy', { territory: cycle.territory?.name ?? '—', kinds: kinds.map(kind => text.kind(kind)).join(', ') })
          : t('cycles.add.everyoneWhy') }}
      </p>
      <DlInput v-model="filters.q" type="search" icon="tabler-search" :label="t('cycles.pros.search')" :placeholder="t('cycles.pros.search')" hide-label />
      <div class="flex gap-2">
        <DlSelect v-model="filters.type" :label="t('cycles.pros.kind')" :options="kindOptions" appearance="filter" class="flex-1" />
        <DlSelect v-model="filters.speciality" :label="t('cycles.add.speciality')" :options="specialityOptions" appearance="filter" class="flex-1" />
      </div>

      <p v-if="!loading && !rows.length" class="py-4 text-center text-sm text-dl-muted">{{ scope === 'territory' ? t('cycles.add.emptyTerritory') : t('cycles.add.empty') }}</p>
      <ul v-else class="flex flex-col">
        <li v-for="row in rows" :key="row.id">
          <label class="flex cursor-pointer items-center gap-2.5 border-b border-dl-line-soft py-2 text-[13px]">
            <input type="checkbox" class="h-[18px] w-[18px] accent-dl-ink" :checked="picked.has(row.id)" @change="toggle(row)">
            <span class="min-w-0 flex-1">
              <strong class="block font-semibold">{{ row.name }}</strong>
              <small class="block text-xs text-dl-muted">{{ [text.kind(row.type), ...row.specialities, row.commune].filter(Boolean).join(' · ') }}</small>
            </span>
            <span v-if="!row.in_territory" class="text-[11.5px] text-dl-pending">{{ t('cycles.add.outside') }}</span>
          </label>
        </li>
      </ul>
      <DlButton v-if="rows.length < total" variant="ghost" size="sm" :loading="loading" @click="load(true)">{{ t('cycles.add.more', { n: n(total - rows.length) }) }}</DlButton>

      <div v-if="picked.size" class="flex flex-col gap-1.5">
        <DlSelect v-model="segment" :label="t('cycles.add.segmentFor', picked.size)" :options="segmentOptions" />
        <span class="text-xs text-dl-muted">{{ t('cycles.add.segmentHint') }}</span>
        <p v-if="outside" class="rounded-xl bg-dl-pending/10 px-3 py-2 text-[12.5px] text-dl-pending">{{ t('cycles.add.outsideWarn') }}</p>
      </div>
    </div>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton variant="primary" :disabled="!picked.size" :loading="saving" class="ms-auto" @click="save">{{ t('cycles.add.submit', picked.size) }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

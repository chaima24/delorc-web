<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { deleteCycle, fetchCycle, type CycleDetail } from '@/api/tenant/cycles'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlMenu, { type DlMenuItem } from '@/components/DlMenu.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import CycleDatesSection from './CycleDatesSection.vue'
import CycleDaysStrip from './CycleDaysStrip.vue'
import CycleGoalSection from './CycleGoalSection.vue'
import { STATE_TONE, useCycleText } from './cycleDisplay'

// A cycle in the side panel: a quick look (pace, days, segments, goal); "Full page" for the list of
// professionals. Pace, coverage and visits come with visits. Mockup: docs/design/plan-mockups/Cycles.html (frame 2)
const props = defineProps<{ cycleId: number }>()
const emit = defineEmits<{ changed: []; deleted: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const text = useCycleText()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canDelete = (resource: string) => auth.can(`${resource}.delete`)

const cycle = ref<CycleDetail | null>(null)
async function load() {
  const id = props.cycleId
  try {
    const detail = await fetchCycle(id)
    if (id === props.cycleId) cycle.value = detail
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}
watch(() => props.cycleId, () => { cycle.value = null; load() }, { immediate: true })

function onDates(detail: CycleDetail) {
  cycle.value = detail
  emit('changed')
}

async function remove() {
  if (!cycle.value) return
  const ok = await confirm({
    title: t('cycles.delete.title', { name: cycle.value.user?.full_name ?? '' }),
    text: t('cycles.delete.text'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteCycle(cycle.value.id)
    toast.success(t('studio.list.toast.deleted'))
    emit('deleted')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const menuItems = computed<DlMenuItem[]>(() =>
  cycle.value && canDelete('cycles')
    ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: remove }]
    : [])

</script>

<template>
  <DlRecordPanel v-model:open="open" :title="cycle?.user?.full_name ?? t('cycles.title')">
    <template #badges>
      <span v-if="cycle" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-dl-muted">
        <DlBadge size="sm" :tone="STATE_TONE[cycle.state]" :dot="cycle.state === 'running'">{{ text.state(cycle.state, cycle.start_date) }}</DlBadge>
        {{ text.period(cycle.start_date, cycle.end_date) }}<template v-if="cycle.territory"> · {{ cycle.territory.name }}</template>
      </span>
    </template>
    <template #actions>
      <DlButton v-if="cycle" variant="outline" size="sm" icon="tabler-arrows-maximize" :to="{ name: 'tenant-cycle-detail', params: { id: cycle.id } }">{{ t('cycles.panel.fullPage') }}</DlButton>
      <DlMenu v-if="menuItems.length" :label="t('fieldSetup.menu.label')" :items="menuItems" />
    </template>

    <div v-if="!cycle" class="flex flex-col gap-3"><DlSkeleton v-for="i in 4" :key="i" class="h-20 rounded-2xl" /></div>
    <div v-else class="flex flex-col gap-3.5">
      <div class="flex items-center gap-3">
        <DlAvatar :name="cycle.user?.full_name ?? '?'" :src="cycle.user?.avatar?.url" size="lg" tone="signal" />
        <span class="text-[13px] text-dl-body">{{ text.roleTeam(cycle.user) }}</span>
      </div>

      <dl class="grid grid-cols-3 gap-2">
        <div class="flex flex-col gap-0.5 rounded-2xl bg-dl-mist px-3.5 py-2.5">
          <dt class="text-[11.5px] text-dl-muted">{{ t('cycles.columns.professionals') }}</dt>
          <dd class="font-display text-lg font-extrabold">{{ n(cycle.professionals) }}</dd>
        </div>
        <div class="flex flex-col gap-0.5 rounded-2xl bg-dl-mist px-3.5 py-2.5">
          <dt class="text-[11.5px] text-dl-muted">{{ t('cycles.figures.toDo') }}</dt>
          <dd class="font-display text-lg font-extrabold">{{ n(cycle.to_do) }}</dd>
        </div>
        <div class="flex flex-col gap-0.5 rounded-2xl bg-dl-mist px-3.5 py-2.5">
          <dt class="text-[11.5px] text-dl-muted">{{ t('cycles.figures.goalShort') }}</dt>
          <dd class="font-display text-lg font-extrabold">{{ n(cycle.goal_visits) }}</dd>
        </div>
      </dl>

      <section v-if="cycle.state !== 'upcoming'" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <header class="mb-2 flex items-center gap-2">
          <h3 class="flex-1 text-sm font-semibold">{{ t('cycles.panel.pace') }}</h3>
          <span class="text-xs text-dl-muted">{{ t('cycles.panel.dayOf', { day: n(cycle.days_passed), total: n(cycle.working_days) }) }}</span>
        </header>
        <p class="text-[13px] text-dl-muted">{{ t('cycles.laterVisits') }}</p>
      </section>

      <section v-if="cycle.by_segment.length" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-2 text-sm font-semibold">{{ t('cycles.panel.bySegment') }}</h3>
        <ul class="flex flex-col gap-2">
          <li v-for="segment in cycle.by_segment" :key="segment.id ?? 'none'" class="flex items-center justify-between gap-2.5 text-[13px]">
            <span class="inline-flex h-[26px] w-max items-center gap-1.5 rounded-lg border px-2 text-[12.5px] font-semibold" :class="segment.id ? 'border-dl-line' : 'border-dashed border-dl-pending text-dl-pending'">
              <i v-if="segment.color" class="h-[9px] w-[9px] rounded-[3px]" :style="{ background: segment.color }" />{{ segment.name ?? t('cycles.segment.none') }}
            </span>
            <span class="text-end text-xs text-dl-muted">{{ t('cycles.panel.professionalsCount', { n: n(segment.professionals) }, segment.professionals) }}</span>
          </li>
        </ul>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <header class="mb-2 flex items-center gap-2">
          <h3 class="flex-1 text-sm font-semibold">{{ t('cycles.days.title') }}</h3>
        </header>
        <CycleDaysStrip :days="cycle.days" small />
      </section>

      <CycleGoalSection :cycle="cycle" />
      <CycleDatesSection :cycle="cycle" @saved="onDates" />

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('cycles.panel.details') }}</h3>
        <dl class="grid grid-cols-[120px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <dt class="text-dl-muted">{{ t('cycles.panel.next') }}</dt>
          <dd>
            <RouterLink v-if="cycle.next" :to="{ name: 'tenant-cycle-detail', params: { id: cycle.next.id } }" class="text-dl-cobalt no-underline hover:underline">{{ text.period(cycle.next.start_date, cycle.next.end_date ?? cycle.next.start_date) }}</RouterLink>
            <template v-else>
              <span class="text-dl-pending">{{ t('cycles.panel.noNext') }}</span>
              · <RouterLink :to="{ name: 'tenant-cycle-create', query: { prepare: cycle.end_date.slice(0, 7), users: String(cycle.user?.id ?? '') } }" class="text-dl-cobalt no-underline hover:underline">{{ t('cycles.panel.prepareIt') }}</RouterLink>
            </template>
          </dd>
          <dt class="text-dl-muted">{{ t('cycles.panel.createdBy') }}</dt>
          <dd>{{ cycle.created_by?.full_name ?? '—' }}<template v-if="cycle.created_at"> · {{ text.day(cycle.created_at) }}</template></dd>
        </dl>
      </section>
    </div>
  </DlRecordPanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchVisit, type Visit } from '@/api/tenant/visits'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useVisitText } from './visitDisplay'

// The short panel of the list: a visit's summary, to go through several without leaving the list. The full
// visit is on its page. Mockup: docs/design/visits-mockups/Visits.html (frame 2)
const props = defineProps<{ visitId: number }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const text = useVisitText()
const visit = ref<Visit | null>(null)

watch(() => props.visitId, async (id) => {
  visit.value = null
  visit.value = await fetchVisit(id).catch(() => null)
}, { immediate: true })
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="visit?.target.name ?? t('visits.title')" :description="visit ? text.where(visit.target) : undefined">
    <template v-if="visit" #badges>
      <span class="mt-1 flex flex-wrap items-center gap-1.5">
        <DlBadge size="sm" :tone="text.tone(visit)" dot>{{ text.state(visit) }}</DlBadge>
        <DlBadge v-if="visit.off_list" size="sm" tone="warning">{{ t('visits.offList') }}</DlBadge>
      </span>
    </template>

    <div v-if="!visit" class="flex flex-col gap-3"><DlSkeleton v-for="i in 3" :key="i" class="h-14 rounded-2xl" /></div>
    <div v-else class="flex flex-col gap-3.5">
      <dl class="grid grid-cols-[120px_1fr] gap-x-2.5 gap-y-2 text-[13.5px]">
        <dt class="text-dl-muted">{{ t('visits.fields.day') }}</dt><dd class="first-letter:uppercase">{{ text.dayLong(visit.visit_date) }}<template v-if="visit.visit_time"> · {{ visit.visit_time }}</template></dd>
        <dt class="text-dl-muted">{{ t('visits.fields.person') }}</dt><dd>{{ visit.user?.full_name ?? '—' }}</dd>
        <dt class="text-dl-muted">{{ t('visits.fields.canal') }}</dt><dd>{{ visit.canal?.name ?? '—' }}</dd>
        <dt class="text-dl-muted">{{ t('visits.fields.cycle') }}</dt><dd>{{ visit.cycle ? t('visits.cyclePeriod', { from: text.date(visit.cycle.start_date), to: text.date(visit.cycle.end_date) }) : t('visits.noCycle') }}</dd>
        <template v-if="visit.status === 'done'">
          <dt class="text-dl-muted">{{ t('visits.blocks.brands') }}</dt><dd>{{ text.brands(visit) || '—' }}</dd>
          <dt class="text-dl-muted">{{ t('visits.blocks.advs') }}</dt><dd>{{ n(visit.advs?.length ?? 0) }}</dd>
          <dt class="text-dl-muted">{{ t('visits.fields.coaches') }}</dt><dd>{{ visit.coaches?.map(person => person.full_name).join(', ') || '—' }}</dd>
        </template>
        <template v-if="visit.status === 'cancelled'">
          <dt class="text-dl-muted">{{ t('visits.cancel.reason') }}</dt><dd>{{ visit.cancel_reason?.name ?? '—' }}<small v-if="visit.cancel_note" class="block text-xs text-dl-muted">{{ visit.cancel_note }}</small></dd>
        </template>
        <template v-if="visit.objective">
          <dt class="text-dl-muted">{{ t('visits.fields.objective') }}</dt><dd>{{ visit.objective }}</dd>
        </template>
      </dl>
      <p v-if="visit.next_objective" class="rounded-xl bg-dl-mist px-3 py-2.5 text-[13px]">
        <strong class="block text-xs text-dl-muted">{{ t('visits.fields.nextObjective') }}</strong>{{ visit.next_objective }}
      </p>
      <p v-if="visit.late" class="rounded-xl bg-dl-pending/8 px-3 py-2.5 text-xs text-dl-pending">{{ t('visits.late.hint') }}</p>
    </div>

    <template v-if="visit" #footer>
      <DlButton variant="dark" icon="tabler-arrow-right" class="flex-1" :to="{ name: 'tenant-visit-detail', params: { id: visit.id } }">{{ t('visits.open') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

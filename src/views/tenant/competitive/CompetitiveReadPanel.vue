<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CompetitiveInformation } from '@/api/tenant/competitive'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { STATUS_TONE, useCompetitiveText } from './competitiveDisplay'

// Reading panel beside the list: the note's general information only; everything else on its page. Mockup frame 1.
const props = defineProps<{ note: CompetitiveInformation }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const text = useCompetitiveText()

const labels = (type: 'source' | 'action_type') => (props.note.details?.[type] ?? []).map(row => row.content ?? row.other_comment).join(', ') || '—'
const rows = computed(() => [
  { label: t('competitive.fields.laboratory'), value: props.note.laboratory },
  { label: t('competitive.fields.product'), value: props.note.product },
  { label: t('competitive.fields.brand'), value: props.note.brand?.name ?? '—' },
  { label: t('competitive.lists.source'), value: props.note.details ? labels('source') : '…' },
  { label: t('competitive.lists.action_type'), value: props.note.details ? labels('action_type') : '…' },
  { label: t('competitive.fields.urgency'), value: text.level(props.note.urgency_level) },
  { label: t('competitive.fields.files'), value: String(props.note.files?.length ?? props.note.files_count ?? 0) },
])
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="note.number">
    <template #badges>
      <span class="mt-1 flex flex-wrap items-center gap-1.5">
        <DlBadge size="sm" :tone="STATUS_TONE[note.status]" dot>{{ text.status(note.status) }}</DlBadge>
        <span class="text-xs text-dl-muted">{{ t('competitive.read.by', { name: note.user?.full_name ?? '', date: text.date(note.seen_on) }) }}</span>
      </span>
    </template>
    <dl class="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-[13px]">
      <template v-for="row in rows" :key="row.label">
        <dt class="text-dl-muted">{{ row.label }}</dt><dd>{{ row.value }}</dd>
      </template>
    </dl>
    <template #footer>
      <DlButton variant="dark" icon-end="tabler-arrow-up-right" class="flex-1" :to="{ name: 'tenant-competitive-information', params: { id: note.id } }">
        {{ t('users.read.openFullPage') }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Hcp } from '@/api/tenant/hcps'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import HcpBadges from './HcpBadges.vue'
import { avatarName, useHcpText } from './hcpForm'
import { useHcpFigures } from './useHcpFigures'

// Reading panel: 3 figures, contact, place, current workplaces. Editing is on the full page.
// Mockup: docs/design/customers-mockups/Professionals.html (frame 2)
const props = defineProps<{ hcp: Hcp }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const text = useHcpText()
const figures = useHcpFigures(() => props.hcp)

const tiles = computed(() => figures.value.filter(f => f.key !== 'cycle'))
const current = computed(() => (props.hcp.workplaces ?? props.hcp.current_workplaces ?? []).filter(w => !w.end_date || w.end_date >= new Date().toISOString().slice(0, 10)))
const contact = computed(() => [
  { label: t('hcps.fields.phone'), value: props.hcp.phone || '—' },
  { label: t('hcps.fields.email'), value: props.hcp.email || '—' },
  { label: t('hcps.fields.prefers'), value: props.hcp.contacted_by ? t(`hcps.contactedBy.${props.hcp.contacted_by}`) : '—' },
])
const gps = computed(() => (props.hcp.latitude != null && props.hcp.longitude != null ? `${props.hcp.latitude}, ${props.hcp.longitude}` : null))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="hcp.name">
    <template #media><DlAvatar :name="avatarName(hcp.name)" size="lg" tone="signal" /></template>
    <template #badges><HcpBadges :hcp="hcp" class="mt-1" /></template>

    <div class="flex flex-col gap-3.5">
      <dl class="grid grid-cols-3 gap-2">
        <div v-for="tile in tiles" :key="tile.key" class="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-dl-mist px-3.5 py-2.5">
          <dt class="truncate text-[11.5px] text-dl-muted">{{ tile.label }}</dt>
          <dd class="truncate text-[15px] font-bold tabular-nums" :class="tile.tone">{{ tile.value }}</dd>
        </div>
      </dl>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('hcps.read.contact') }}</h3>
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <template v-for="row in contact" :key="row.label"><dt class="text-dl-muted">{{ row.label }}</dt><dd class="min-w-0 break-words">{{ row.value }}</dd></template>
        </dl>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('hcps.read.place') }}</h3>
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <dt class="text-dl-muted">{{ t('hcps.fields.address') }}</dt><dd>{{ hcp.address || '—' }}</dd>
          <dt class="text-dl-muted">{{ t('hcps.fields.commune') }}</dt><dd>{{ text.place(hcp) }}</dd>
          <dt class="text-dl-muted">{{ t('hcps.fields.gps') }}</dt>
          <dd><a v-if="gps" :href="`https://www.google.com/maps?q=${gps}`" target="_blank" rel="noopener" class="text-dl-cobalt">{{ gps }} ↗</a><span v-else>—</span></dd>
        </dl>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('hcps.read.worksAt') }}</h3>
        <ul v-if="current.length" class="flex flex-col gap-2">
          <li v-for="workplace in current" :key="workplace.id" class="flex gap-2.5 text-[13px]">
            <span class="w-1 shrink-0 rounded-full bg-dl-cobalt" aria-hidden="true" />
            <span class="flex flex-col">
              <span class="font-semibold">{{ workplace.hco?.name ?? '—' }}</span>
              <span class="text-xs text-dl-muted">{{ workplace.speciality?.name ?? '—' }} · {{ t('hcps.workplaces.sinceDate', { date: text.date(workplace.start_date) }) }}</span>
            </span>
          </li>
        </ul>
        <p v-else class="text-[13px] text-dl-muted">{{ t('hcps.workplaces.none') }}</p>
      </section>
    </div>

    <template #footer>
      <DlButton variant="dark" icon-end="tabler-arrow-up-right" class="flex-1" :to="{ name: 'tenant-hcp-detail', params: { id: hcp.id } }">
        {{ t('users.read.openFullPage') }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>

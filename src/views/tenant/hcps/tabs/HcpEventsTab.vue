<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchHcpEvents, type HcpEventRow } from '@/api/tenant/events'
import type { Hcp } from '@/api/tenant/hcps'
import DlBadge from '@/components/DlBadge.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useAuthStore } from '@/stores/auth'
import { useEventText } from '@/views/tenant/events/eventDisplay'

// A professional's events (docs/api/events.md, mockup frame 13): where they were invited, by whom, present or not,
// and « pris en charge » when the lab has that feature.
const props = defineProps<{ hcp: Hcp }>()
const { t, n } = useI18n()
const auth = useAuthStore()
const text = useEventText()
const sponsoring = computed(() => auth.hasFeature('events.sponsoring'))

const rows = ref<HcpEventRow[] | null>(null)
watch(() => props.hcp.id, async id => {
  rows.value = null
  rows.value = await fetchHcpEvents(id).catch(() => [])
}, { immediate: true })
const present = computed(() => (rows.value ?? []).filter(row => row.present).length)
</script>

<template>
  <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
    <header class="flex items-center gap-2">
      <h2 class="flex-1 text-[15px] font-semibold">{{ t('events.list.title') }}</h2>
      <span v-if="rows?.length" class="rounded-full bg-dl-mist px-2.5 py-1 text-xs">{{ t('events.hcp.counts', { invited: n(rows.length), present: n(present) }) }}</span>
    </header>
    <DlSkeleton v-if="!rows" class="h-32 rounded-2xl" />
    <p v-else-if="!rows.length" class="py-4 text-[13px] text-dl-muted">{{ t('events.hcp.none') }}</p>
    <table v-else class="w-full text-sm">
      <thead class="text-xs text-dl-muted"><tr>
        <th class="py-1.5 text-start font-medium">{{ t('events.columns.event') }}</th>
        <th class="py-1.5 text-start font-medium">{{ t('events.columns.dates') }}</th>
        <th class="py-1.5 text-start font-medium">{{ t('events.columns.invitedBy') }}</th>
        <th class="py-1.5 text-start font-medium">{{ t('events.part.present') }}</th>
        <th v-if="sponsoring" class="py-1.5 text-end font-medium">{{ t('events.part.sponsored') }}</th>
      </tr></thead>
      <tbody>
        <tr v-for="row in rows" :key="row.event.id" class="border-t border-dl-line-soft">
          <td class="py-2">
            <RouterLink :to="{ name: 'tenant-event', params: { id: row.event.id } }" class="font-semibold no-underline">{{ row.event.name }}</RouterLink>
            <span class="block text-xs text-dl-muted">{{ row.event.campaign?.name ?? text.status(row.event.status) }}</span>
          </td>
          <td class="whitespace-nowrap">{{ text.day(row.event.start_at) }}</td>
          <td>{{ row.invited_by.full_name }}</td>
          <td><DlBadge size="sm" :tone="row.present ? 'success' : 'neutral'">{{ row.present ? t('events.part.yes') : new Date(row.event.start_at.replace(' ', 'T')) > new Date() ? t('events.part.toCome') : t('events.part.no') }}</DlBadge></td>
          <td v-if="sponsoring" class="text-end tabular-nums">{{ row.sponsored ? text.money(row.sponsored_amount ?? null) : '—' }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

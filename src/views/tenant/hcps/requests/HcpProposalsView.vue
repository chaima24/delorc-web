<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { fetchHcpRequests, type Hcp, type HcpRequestState } from '@/api/tenant/hcps'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlPagination from '@/components/DlPagination.vue'
import { useToast } from '@/composables/useToast'
import { useUserText } from '@/views/tenant/users/userDisplay'
import { avatarName, useHcpText } from '../hcpForm'

// My proposals: the professionals I proposed and the answer (waiting, approved by whom, refused and why).
// Mockup: docs/design/customers-mockups/HcpRequests.html (frame 5)
const { t } = useI18n()
const toast = useToast()
const text = useHcpText()
const userText = useUserText()

type Row = Hcp & { state: HcpRequestState }
const rows = shallowRef<Row[]>([])
const total = ref(0)
const page = ref(1)
const perPage = ref(25)
const loading = ref(true)

// Every state, newest first (three small calls: waiting ones first, then the decided ones).
async function load() {
  loading.value = true
  try {
    const states: HcpRequestState[] = ['waiting', 'approved', 'refused']
    const parts = await Promise.all(states.map(state => fetchHcpRequests({ 'filter[mine]': 1, 'filter[state]': state, per_page: 100 })))
    const all = parts.flatMap((response, i) => response.data.map(hcp => ({ ...hcp, state: states[i] }) as Row))
    total.value = all.length
    rows.value = all.slice((page.value - 1) * perPage.value, page.value * perPage.value)
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
watch([page, perPage], load, { immediate: true })

const TONES = { waiting: 'warning', approved: 'success', refused: 'danger' } as const
const person = (user?: Hcp['decided_by']) => user?.full_name ?? ''
const columns = [
  { key: 'name', label: t('hcps.columns.professional') },
  { key: 'sent', label: t('hcps.proposals.sent') },
  { key: 'answer', label: t('hcps.proposals.answer') },
]
</script>

<template>
  <div class="flex w-full flex-col gap-5 pb-10">
    <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex flex-wrap items-center gap-1.5 text-sm text-dl-muted">
      <span>{{ t('nav.workspaces.customers') }}</span>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <RouterLink :to="{ name: 'tenant-hcps' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('hcps.title') }}</RouterLink>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <span>{{ t('hcps.proposals.title') }}</span>
    </nav>
    <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[34px]">{{ t('hcps.proposals.title') }}</h1>

    <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
      <DlDataList :label="t('hcps.proposals.title')" :columns="columns" :rows="rows" :row-key="row => row.id" :loading="loading" :empty-title="t('hcps.proposals.empty')">
        <template #cell-name="{ row }">
          <span class="flex items-center gap-2.5">
            <DlAvatar :name="avatarName(row.name)" size="sm" tone="neutral" />
            <span class="flex min-w-0 flex-col">
              <RouterLink v-if="row.state !== 'refused'" :to="{ name: 'tenant-hcp-detail', params: { id: row.id } }" class="font-semibold text-dl-fg no-underline hover:underline">{{ row.name }}</RouterLink>
              <strong v-else class="font-semibold">{{ row.name }}</strong>
              <span class="truncate text-xs text-dl-muted">{{ [text.mainWorkplace(row).speciality ?? text.type(row.type), row.commune?.name].filter(Boolean).join(' · ') }}</span>
            </span>
          </span>
        </template>
        <template #cell-sent="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ userText.dateTime(row.created_at) }}</span></template>
        <template #cell-answer="{ row }">
          <span class="flex flex-wrap items-center gap-2">
            <DlBadge size="sm" :tone="TONES[row.state]" dot>{{ t(`hcps.proposals.states.${row.state}`) }}</DlBadge>
            <span v-if="row.state === 'approved'" class="text-xs text-dl-muted">{{ t('hcps.proposals.by', { name: person(row.decided_by), date: text.date(row.decided_at) }) }}</span>
            <span v-else-if="row.state === 'refused'" class="text-xs text-dl-muted">“{{ row.refusal_reason }}”</span>
          </span>
        </template>
        <template #card="{ row }">
          <span class="flex flex-col gap-1">
            <strong class="font-semibold">{{ row.name }}</strong>
            <span class="flex flex-wrap items-center gap-2">
              <DlBadge size="sm" :tone="TONES[row.state]" dot>{{ t(`hcps.proposals.states.${row.state}`) }}</DlBadge>
              <span v-if="row.state === 'refused'" class="text-xs text-dl-muted">“{{ row.refusal_reason }}”</span>
            </span>
          </span>
        </template>
      </DlDataList>
      <DlPagination v-if="total > perPage" v-model="page" v-model:per-page="perPage" :total="total" />
    </section>
  </div>
</template>

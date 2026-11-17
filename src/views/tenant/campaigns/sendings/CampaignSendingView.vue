<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { cancelCampaignSending, fetchCampaignSending, type CampaignSending, type SendingRecipient } from '@/api/tenant/campaignSendings'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useMessageText } from '../messages/messageDisplay'
import { RECIPIENT_TONE, SENDING_TONE, useSendingText } from './sendingDisplay'

// A sending's page: five figures, then each professional with their state, sent, opened, clicked, the server's
// error. A scheduled or running sending can be cancelled; a running one refreshes by itself. Mockup frames 5 and 6.
const props = defineProps<{ id: string; sendingId: string }>()
const { t, n } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useSendingText()
const messageText = useMessageText()

const sending = ref<CampaignSending | null>(null)
const failed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
async function load() {
  clearTimeout(timer)
  try {
    sending.value = await fetchCampaignSending(Number(props.sendingId))
    if (sending.value.status === 'running' || sending.value.status === 'scheduled') timer = setTimeout(load, 5000)
  }
  catch {
    failed.value = true
  }
}
watch(() => props.sendingId, load, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
const back = computed(() => ({ name: 'tenant-campaign', params: { id: props.id }, query: { tab: 'sendings' } }))
const canCancel = computed(() => auth.can('campaigns.update') && ['scheduled', 'running'].includes(sending.value?.status ?? ''))

const TILES = computed(() => {
  const c = sending.value?.counts
  if (!c) return []
  return [
    { value: c.sent, label: t('campaignSendings.tiles.sent', { total: n(c.recipients) }), of: c.recipients, color: 'bg-dl-teal' },
    { value: c.failed, label: t('campaignSendings.tiles.failed'), of: c.recipients, color: 'bg-dl-rejected' },
    { value: c.opened, label: t('campaignSendings.tiles.opened', { percent: text.percent(c.opened, c.sent) }), of: c.sent, color: 'bg-dl-cobalt' },
    { value: c.clicked, label: t('campaignSendings.tiles.clicked', { percent: text.percent(c.clicked, c.sent) }), of: c.sent, color: 'bg-dl-pending' },
    { value: c.unsubscribed, label: t('campaignSendings.tiles.unsubscribed'), of: c.sent, color: 'bg-dl-ink' },
  ]
})

const ALL = 'all'
const show = ref(ALL)
const search = ref('')
const showItems = computed(() => [ALL, 'sent', 'failed', 'opened', 'clicked', 'unsubscribed', 'cancelled'].map(value => ({ value, label: value === ALL ? t('campaignMessages.filter.all') : t(`campaignSendings.show.${value}`) })))
const rows = computed(() => {
  const word = search.value.trim().toLowerCase()
  return (sending.value?.recipients ?? []).filter((row) => {
    const kind = show.value
    const matches = kind === ALL || (kind === 'opened' ? !!row.opened_at : kind === 'clicked' ? !!row.clicked_at : kind === 'unsubscribed' ? !!row.unsubscribed_at : row.status === kind)
    return matches && (!word || `${row.hcp?.name ?? ''} ${row.email}`.toLowerCase().includes(word))
  })
})
const columns = computed(() => [
  { key: 'name', label: t('campaignSendings.columns.professional') },
  { key: 'email', label: t('campaignSendings.columns.address'), secondary: true },
  { key: 'status', label: t('campaignMessages.columns.status') },
  { key: 'sent_at', label: t('campaignSendings.columns.sentAt') },
  { key: 'opened_at', label: t('campaignSendings.columns.openedAt'), secondary: true },
  { key: 'clicked_at', label: t('campaignSendings.columns.clickedAt'), secondary: true },
  { key: 'error', label: t('campaignSendings.columns.error'), secondary: true },
])
const state = (row: SendingRecipient) => (row.unsubscribed_at ? t('campaignSendings.show.unsubscribed') : text.recipient(row.status))

async function cancel() {
  const row = sending.value!
  const started = row.status === 'running'
  const ok = await confirm({
    title: t('campaignSendings.cancel.title'),
    text: started ? t('campaignSendings.cancel.running', { sent: n(row.counts.sent), left: n(row.counts.recipients - row.counts.sent - row.counts.failed) }) : t('campaignSendings.cancel.scheduled'),
    confirmButtonText: t('campaignSendings.cancel.confirm'),
    cancelButtonText: t('campaignSendings.cancel.keep'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    sending.value = await cancelCampaignSending(row.id)
    toast.success(t('campaignSendings.cancel.done'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('campaignSendings.page.notFound')">
      <DlButton variant="outline" :to="back">{{ t('campaignMessages.page.back') }}</DlButton>
    </DlEmptyState>
    <DlSkeleton v-else-if="!sending" class="h-96 rounded-3xl" />

    <template v-else>
      <div class="flex flex-col gap-2">
        <nav class="flex flex-wrap items-center gap-1.5 text-[13px] text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
          <RouterLink :to="{ name: 'tenant-campaigns' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('campaigns.list.title') }}</RouterLink>
          <DlIcon icon="tabler-chevron-right" :size="14" />
          <RouterLink :to="back" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('campaigns.tabs.sendings') }}</RouterLink>
        </nav>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="min-w-0 font-display text-[24px] font-extrabold leading-tight tracking-[-0.02em] md:text-[28px]">{{ messageText.fields(sending.subject) }}</h1>
          <DlBadge :tone="SENDING_TONE[sending.status]" dot>
            {{ sending.status === 'running' ? t('campaignSendings.page.running', { sent: n(sending.counts.sent), total: n(sending.counts.recipients) }) : text.status(sending.status) }}
          </DlBadge>
          <div class="ms-auto flex flex-wrap gap-2">
            <DlButton v-if="sending.message" variant="outline" :to="{ name: 'tenant-campaign-message', params: { id, messageId: sending.message.id } }">{{ t('campaignSendings.page.seeMessage') }}</DlButton>
            <DlButton v-if="canCancel" variant="outline" icon="tabler-x" class="text-dl-rejected" @click="cancel">{{ t('campaignSendings.cancel.button') }}</DlButton>
          </div>
        </div>
        <span class="text-[13px] text-dl-muted">
          {{ [sending.created_by ? t('campaignSendings.page.launchedBy', { name: sending.created_by.full_name, date: text.dateTime(sending.created_at) }) : null,
              sending.started_at ? t('campaignSendings.page.started', { date: text.dateTime(sending.started_at) }) : t('campaignSendings.page.scheduled', { date: text.dateTime(sending.scheduled_at) }),
              sending.finished_at ? t('campaignSendings.page.finished', { date: text.dateTime(sending.finished_at) }) : null].filter(Boolean).join(' · ') }}
        </span>
      </div>

      <p v-if="sending.status === 'failed' && sending.failure === 'quota'" class="rounded-2xl bg-dl-rejected/8 px-4 py-3 text-[13.5px] text-dl-rejected">{{ t('campaignSendings.page.quotaFailed') }}</p>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div v-for="tile in TILES" :key="tile.label" class="flex flex-col gap-1 rounded-3xl bg-dl-paper p-4">
          <strong class="font-display text-[28px] leading-none">{{ n(tile.value) }}</strong>
          <span class="text-xs text-dl-muted">{{ tile.label }}</span>
          <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-dl-line-soft"><span class="block h-full rounded-full" :class="tile.color" :style="{ width: `${tile.of ? (tile.value / tile.of) * 100 : 0}%` }" /></div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('campaignSendings.filter.searchPeople')" :placeholder="t('campaignSendings.filter.searchPeople')" icon="tabler-search" hide-label /></div>
        <DlSegmented v-model="show" :label="t('campaignMessages.columns.status')" :items="showItems" />
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList :label="t('campaignSendings.columns.recipients')" :columns="columns" :rows="rows" :row-key="row => row.id" :loading="false" :empty-title="t('geo.empty.search')">
          <template #cell-name="{ row }"><strong class="font-semibold">{{ row.hcp?.name ?? '—' }}</strong></template>
          <template #cell-email="{ row }"><span class="text-dl-muted">{{ row.email }}</span></template>
          <template #cell-status="{ row }"><DlBadge size="sm" :tone="row.unsubscribed_at ? 'ink' : RECIPIENT_TONE[row.status]" dot>{{ state(row) }}</DlBadge></template>
          <template #cell-sent_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.short(row.sent_at) }}</span></template>
          <template #cell-opened_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.short(row.opened_at) }}</span></template>
          <template #cell-clicked_at="{ row }">
            <span class="whitespace-nowrap text-dl-muted">{{ row.clicked_at ? `${text.short(row.clicked_at)} · ${t('campaignSendings.page.clicks', row.clicks)}` : '—' }}</span>
          </template>
          <template #cell-error="{ row }"><span class="text-dl-rejected">{{ row.error ?? '' }}</span></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.hcp?.name ?? '—' }}</strong>
            <span class="text-xs text-dl-muted">{{ [state(row), row.email, row.error].filter(Boolean).join(' · ') }}</span>
          </template>
        </DlDataList>
        <p class="text-xs text-dl-muted">{{ t('campaignSendings.page.note') }}</p>
      </div>
    </template>
  </div>
</template>

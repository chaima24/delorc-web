<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { fetchCampaignSendings, type CampaignSending, type SendingStatus } from '@/api/tenant/campaignSendings'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useMessageText } from '../messages/messageDisplay'
import { SENDING_TONE, useSendingText } from './sendingDisplay'

// A campaign's « Envois » tab: each sending with its state, start, recipients, sent, failed, opened, clicked,
// unsubscribed, and who launched it; the month's email quota next to « + Nouvel envoi ». Mockup frame 1.
const props = defineProps<{ campaignId: number; ended: boolean }>()
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const text = useSendingText()
const messageText = useMessageText()
const canSend = computed(() => auth.can('campaigns.update') && !props.ended)

const ALL = 'all'
const status = ref(ALL)
const rows = ref<CampaignSending[]>([])
const quota = ref<{ sent: number; quota: number | null } | null>(null)
const loading = ref(true)
async function load() {
  loading.value = true
  try {
    const answer = await fetchCampaignSendings(props.campaignId, status.value === ALL ? undefined : status.value as SendingStatus)
    rows.value = answer.items
    quota.value = answer.quota
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
watch(status, load, { immediate: true })

const statusItems = computed(() => [ALL, 'scheduled', 'running', 'done', 'cancelled'].map(value => ({ value, label: value === ALL ? t('campaignMessages.filter.all') : t(`campaignSendings.filter.${value}`) })))
const columns = computed(() => [
  { key: 'subject', label: t('campaignSendings.columns.message') },
  { key: 'status', label: t('campaignMessages.columns.status') },
  { key: 'scheduled_at', label: t('campaignSendings.columns.start') },
  { key: 'recipients', label: t('campaignSendings.columns.recipients'), align: 'end' as const },
  { key: 'sent', label: t('campaignSendings.columns.sent'), align: 'end' as const },
  { key: 'failed', label: t('campaignSendings.columns.failed'), align: 'end' as const, secondary: true },
  { key: 'opened', label: t('campaignSendings.columns.opened'), align: 'end' as const, secondary: true },
  { key: 'clicked', label: t('campaignSendings.columns.clicked'), align: 'end' as const, secondary: true },
  { key: 'unsubscribed', label: t('campaignSendings.columns.unsubscribed'), align: 'end' as const, secondary: true },
  { key: 'created_by', label: t('campaignSendings.columns.by'), secondary: true },
])
const share = (row: CampaignSending, key: 'opened' | 'clicked') => (row.counts.sent ? `${n(row.counts[key])} · ${text.percent(row.counts[key], row.counts.sent)} %` : '—')
const openSending = (row: CampaignSending) => router.push({ name: 'tenant-campaign-sending', params: { id: props.campaignId, sendingId: row.id } })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2.5">
      <DlSegmented v-model="status" :label="t('campaignMessages.columns.status')" :items="statusItems" />
      <span v-if="quota" class="ms-auto text-[13px] text-dl-muted">
        {{ quota.quota === null ? t('campaignSendings.quota.unlimited', { sent: n(quota.sent) }) : t('campaignSendings.quota.line', { sent: n(quota.sent), quota: n(quota.quota) }) }}
      </span>
      <DlButton v-if="canSend" variant="primary" icon="tabler-plus" :class="!quota && 'ms-auto'" :to="{ name: 'tenant-campaign-sending-new', params: { id: campaignId } }">{{ t('campaignSendings.new.button') }}</DlButton>
    </div>

    <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
      <DlDataList
        :label="t('campaigns.tabs.sendings')"
        :columns="columns"
        :rows="rows"
        :row-key="row => row.id"
        :loading="loading"
        :empty-title="t('campaignSendings.list.emptyTitle')"
        :empty-text="t('campaignSendings.list.emptyText')"
        @open="openSending"
      >
        <template #cell-subject="{ row }"><strong class="font-semibold">{{ messageText.fields(row.subject) }}</strong></template>
        <template #cell-status="{ row }"><DlBadge size="sm" :tone="SENDING_TONE[row.status]" dot>{{ text.status(row.status) }}</DlBadge></template>
        <template #cell-scheduled_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.dateTime(row.started_at ?? row.scheduled_at) }}</span></template>
        <template #cell-recipients="{ row }"><span class="tabular-nums">{{ n(row.counts.recipients) }}</span></template>
        <template #cell-sent="{ row }"><span class="tabular-nums">{{ row.counts.sent ? n(row.counts.sent) : '—' }}</span></template>
        <template #cell-failed="{ row }"><span class="tabular-nums">{{ row.counts.failed ? n(row.counts.failed) : '—' }}</span></template>
        <template #cell-opened="{ row }"><span class="whitespace-nowrap tabular-nums">{{ share(row, 'opened') }}</span></template>
        <template #cell-clicked="{ row }"><span class="whitespace-nowrap tabular-nums">{{ share(row, 'clicked') }}</span></template>
        <template #cell-unsubscribed="{ row }"><span class="tabular-nums">{{ row.counts.unsubscribed ? n(row.counts.unsubscribed) : '—' }}</span></template>
        <template #cell-created_by="{ row }"><span class="text-dl-muted">{{ row.created_by?.full_name ?? '—' }}</span></template>
        <template #card="{ row }">
          <strong class="block font-semibold">{{ messageText.fields(row.subject) }}</strong>
          <span class="text-xs text-dl-muted">{{ [text.status(row.status), text.dateTime(row.started_at ?? row.scheduled_at), t('campaignSendings.list.cardCounts', { sent: n(row.counts.sent), total: n(row.counts.recipients) })].join(' · ') }}</span>
        </template>
      </DlDataList>
      <p class="text-xs text-dl-muted">{{ t('campaignSendings.list.note') }}</p>
    </div>
  </div>
</template>

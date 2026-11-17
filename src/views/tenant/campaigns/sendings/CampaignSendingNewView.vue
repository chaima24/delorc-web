<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchCampaign, type Campaign } from '@/api/tenant/campaigns'
import { fetchCampaignMessages, type CampaignMessage } from '@/api/tenant/campaignMessages'
import { createCampaignSending, fetchSendingCandidates, type SendingCandidate } from '@/api/tenant/campaignSendings'
import DlButton from '@/components/DlButton.vue'
import DlDatePicker from '@/components/DlDatePicker.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useToast } from '@/composables/useToast'
import { useMessageText } from '../messages/messageDisplay'
import { useSendingText } from './sendingDisplay'

// « + Nouvel envoi »: an approved email, then the professionals the grid targets with a given consent (filters,
// ticks, « Tout cocher » leaving out who already received it), then « quand » in a panel: now or a quarter hour inside
// the campaign, with the month's quota. Mockup: docs/design/campaigns-mockups/Sendings.html (frames 2 to 4)
const props = defineProps<{ id: string }>()
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const text = useSendingText()
const messageText = useMessageText()

const campaign = ref<Campaign | null>(null)
const messages = ref<CampaignMessage[]>([])
const failed = ref(false)
const messageId = ref<number | null>(null)
async function load() {
  try {
    const [row, list] = await Promise.all([fetchCampaign(Number(props.id)), fetchCampaignMessages(Number(props.id), { 'filter[status]': 'approved', 'filter[channel]': 'email' })])
    campaign.value = row
    messages.value = list
    const asked = Number(route.query.message)
    messageId.value = list.find(item => item.id === asked)?.id ?? list[0]?.id ?? null
  }
  catch {
    failed.value = true
  }
}
load()
const back = computed(() => ({ name: 'tenant-campaign', params: { id: props.id }, query: { tab: 'sendings' } }))
const messageItems = computed(() => messages.value.map(row => ({ value: row.id, label: `${messageText.fields(row.subject)} · ${t('campaignSendings.new.approvedBy', { name: row.approved_by?.full_name ?? '—', date: messageText.date(row.approved_at) })}` })))
const message = computed({ get: () => messageId.value, set: value => { messageId.value = value == null ? null : Number(value) } })

// The candidates of the chosen message; ticks start on everyone who can receive it and never got it.
const candidates = ref<SendingCandidate[] | null>(null)
const quotaLeft = ref<number | null>(null)
const ticked = ref(new Set<number>())
watch(messageId, async value => {
  candidates.value = null
  if (!value) return
  try {
    const answer = await fetchSendingCandidates(Number(props.id), value)
    candidates.value = answer.items
    quotaLeft.value = answer.quotaLeft
    ticked.value = new Set(answer.items.filter(row => row.can_receive && !row.already_received).map(row => row.hcp_id))
  }
  catch (error) {
    candidates.value = []
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
})

// Filters, done on this answer (one campaign's targets).
const ALL = 0
const search = ref('')
const filters = ref({ speciality: ALL, wilaya: ALL, segment: ALL, type: '' })
const options = (pick: (row: SendingCandidate) => { id: number; name: string } | null, all: string) => {
  const seen = new Map<number, string>()
  for (const row of candidates.value ?? []) { const item = pick(row); if (item) seen.set(item.id, item.name) }
  return [{ value: ALL, label: all }, ...[...seen].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }))]
}
const specialityItems = computed(() => options(row => row.speciality, t('campaignSendings.filter.allSpecialities')))
const wilayaItems = computed(() => options(row => row.wilaya, t('campaignSendings.filter.allWilayas')))
const segmentItems = computed(() => options(row => row.segment, t('campaignSendings.filter.allSegments')))
const typeItems = computed(() => [{ value: '', label: t('campaignSendings.filter.allTypes') }, ...[...new Set((candidates.value ?? []).map(row => row.type).filter(Boolean))].map(type => ({ value: type as string, label: t(`hcps.types.${type}`) }))])
const field = (key: 'speciality' | 'wilaya' | 'segment') => computed({ get: () => filters.value[key], set: value => { filters.value[key] = Number(value ?? ALL) } })
const speciality = field('speciality')
const wilaya = field('wilaya')
const segment = field('segment')
const type = computed({ get: () => filters.value.type, set: value => { filters.value.type = String(value ?? '') } })
const shown = computed(() => {
  const word = search.value.trim().toLowerCase()
  const f = filters.value
  return (candidates.value ?? []).filter(row => (!word || `${row.name} ${row.email ?? ''}`.toLowerCase().includes(word))
    && (!f.speciality || row.speciality?.id === f.speciality) && (!f.wilaya || row.wilaya?.id === f.wilaya)
    && (!f.segment || row.segment?.id === f.segment) && (!f.type || row.type === f.type))
})
const LIMIT_STEP = 100
const limit = ref(LIMIT_STEP)
watch([search, filters], () => { limit.value = LIMIT_STEP }, { deep: true })
const page = computed(() => shown.value.slice(0, limit.value))
const receivable = computed(() => (candidates.value ?? []).filter(row => row.can_receive))
const shownReceivable = computed(() => shown.value.filter(row => row.can_receive))
const allShownTicked = computed(() => shownReceivable.value.length > 0 && shownReceivable.value.every(row => ticked.value.has(row.hcp_id)))
function toggle(id: number) {
  const next = new Set(ticked.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  ticked.value = next
}
/** « Tout cocher » ticks who is shown and never got it; a second click unticks who is shown. */
function tickAll() {
  const next = new Set(ticked.value)
  if (allShownTicked.value) shownReceivable.value.forEach(row => next.delete(row.hcp_id))
  else shownReceivable.value.filter(row => !row.already_received).forEach(row => next.add(row.hcp_id))
  ticked.value = next
}
const whyText = (row: SendingCandidate) => (row.why === 'opted_out' ? t('campaignSendings.why.opted_out', { date: messageText.date(row.opted_out_at) }) : t('campaignSendings.why.no_email'))

// Step 2: when. A quarter hour inside the campaign; the quota gauge.
const whenOpen = ref(false)
const now = ref(true)
const day = ref('')
const hour = ref('08:30')
const HOURS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`).map(value => ({ value, label: value }))
const today = () => new Date().toISOString().slice(0, 10)
const minDay = computed(() => (campaign.value && campaign.value.start_date > today() ? campaign.value.start_date : today()))
const count = computed(() => ticked.value.size)
const tooMany = computed(() => quotaLeft.value !== null && count.value > quotaLeft.value)
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function openWhen() {
  errors.value = {}
  day.value ||= minDay.value
  whenOpen.value = true
}
async function launch() {
  errors.value = {}
  saving.value = true
  try {
    const at = now.value ? null : new Date(`${day.value}T${hour.value}:00`).toISOString()
    const sending = await createCampaignSending({ campaign_message_id: messageId.value!, hcp_ids: [...ticked.value], scheduled_at: at })
    toast.success(now.value ? t('campaignSendings.new.doneNow') : t('campaignSendings.new.doneLater', { date: text.dateTime(sending.scheduled_at) }))
    router.push({ name: 'tenant-campaign-sending', params: { id: props.id, sendingId: sending.id } })
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('campaigns.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-campaigns' }">{{ t('campaigns.page.back') }}</DlButton>
    </DlEmptyState>
    <DlSkeleton v-else-if="!campaign" class="h-96 rounded-3xl" />

    <template v-else>
      <div class="flex flex-col gap-1.5">
        <nav class="flex flex-wrap items-center gap-1.5 text-[13px] text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
          <RouterLink :to="{ name: 'tenant-campaigns' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('campaigns.list.title') }}</RouterLink>
          <DlIcon icon="tabler-chevron-right" :size="14" />
          <RouterLink :to="back" class="text-dl-muted no-underline hover:text-dl-fg">{{ campaign.name }} · {{ t('campaigns.tabs.sendings') }}</RouterLink>
        </nav>
        <h1 class="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] md:text-[30px]">{{ t('campaignSendings.new.title') }}</h1>
      </div>

      <DlEmptyState v-if="!messages.length" icon="tabler-mail-off" :title="t('campaignSendings.new.noMessageTitle')" :text="t('campaignSendings.new.noMessageText')">
        <DlButton variant="outline" :to="{ name: 'tenant-campaign', params: { id }, query: { tab: 'messages' } }">{{ t('campaigns.tabs.messages') }}</DlButton>
      </DlEmptyState>

      <template v-else>
        <DlSelect v-model="message" :label="t('campaignSendings.new.message')" :options="messageItems" />

        <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
          <header class="flex flex-wrap items-center gap-2">
            <h2 class="text-[15px] font-semibold">{{ t('campaignSendings.new.recipients') }}</h2>
            <span class="text-xs text-dl-muted">{{ t('campaignSendings.new.rule', { name: campaign.name }) }}</span>
            <span class="ms-auto rounded-full bg-dl-signal-soft px-3 py-1 text-xs font-bold">{{ t('campaignSendings.new.ticked', { count: n(count), total: n(receivable.length) }) }}</span>
          </header>
          <div class="flex flex-wrap items-center gap-2.5">
            <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('campaignSendings.filter.search')" :placeholder="t('campaignSendings.filter.search')" icon="tabler-search" hide-label /></div>
            <DlSelect v-model="speciality" :label="t('campaignSendings.columns.speciality')" :options="specialityItems" appearance="filter" />
            <DlSelect v-model="wilaya" :label="t('campaignSendings.columns.wilaya')" :options="wilayaItems" appearance="filter" />
            <DlSelect v-if="segmentItems.length > 1" v-model="segment" :label="t('campaignSendings.columns.segment')" :options="segmentItems" appearance="filter" />
            <DlSelect v-if="typeItems.length > 2" v-model="type" :label="t('campaignSendings.columns.type')" :options="typeItems" appearance="filter" />
            <DlButton size="sm" variant="outline" class="ms-auto" :disabled="!shownReceivable.length" @click="tickAll">{{ allShownTicked ? t('campaignSendings.new.untickAll') : t('campaignSendings.new.tickAll') }}</DlButton>
          </div>

          <DlSkeleton v-if="!candidates" class="h-48 rounded-2xl" />
          <p v-else-if="!candidates.length" class="py-6 text-center text-[13px] text-dl-muted">{{ t('campaignSendings.new.nobody') }}</p>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-[13.5px]">
              <thead>
                <tr class="border-b border-dl-line text-start text-xs text-dl-muted">
                  <th class="w-10 py-2" />
                  <th class="py-2 text-start font-semibold">{{ t('campaignSendings.columns.professional') }}</th>
                  <th class="py-2 text-start font-semibold">{{ t('campaignSendings.columns.speciality') }}</th>
                  <th class="py-2 text-start font-semibold max-md:hidden">{{ t('campaignSendings.columns.wilaya') }}</th>
                  <th class="py-2 text-start font-semibold max-md:hidden">{{ t('campaignSendings.columns.segment') }}</th>
                  <th class="py-2 text-start font-semibold max-md:hidden">{{ t('campaignSendings.columns.address') }}</th>
                  <th class="py-2" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in page" :key="row.hcp_id" class="border-b border-dl-line-soft" :class="!row.can_receive && 'opacity-55'">
                  <td class="py-2.5">
                    <input v-if="row.can_receive" type="checkbox" class="h-4 w-4 accent-dl-ink" :checked="ticked.has(row.hcp_id)" :aria-label="row.name" @change="toggle(row.hcp_id)">
                  </td>
                  <td class="py-2.5 font-semibold">{{ row.name }}</td>
                  <td class="py-2.5">{{ row.speciality?.name ?? '—' }}</td>
                  <td class="py-2.5 max-md:hidden">{{ row.wilaya?.name ?? '—' }}</td>
                  <td class="py-2.5 max-md:hidden">{{ row.segment?.name ?? '—' }}</td>
                  <td class="py-2.5 text-dl-muted max-md:hidden">{{ row.email ?? '—' }}</td>
                  <td class="py-2.5 text-end">
                    <span v-if="row.already_received" class="whitespace-nowrap rounded-full bg-dl-pending/15 px-2 py-0.5 text-[11.5px] font-bold text-dl-pending">↻ {{ t('campaignSendings.new.alreadyReceived') }}</span>
                    <span v-else-if="!row.can_receive" class="text-xs text-dl-muted">{{ whyText(row) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <DlButton v-if="shown.length > page.length" variant="ghost" size="sm" class="mt-2" @click="limit += LIMIT_STEP">{{ t('campaignSendings.new.more', { count: n(shown.length - page.length) }) }}</DlButton>
          </div>
          <p v-if="candidates?.length" class="rounded-xl bg-dl-mist px-3 py-2 text-[12.5px] text-dl-muted">
            {{ t('campaignSendings.new.summary', { total: n(candidates.length), can: n(receivable.length), cannot: n(candidates.length - receivable.length) }) }}
          </p>
          <span v-if="errors.hcp_ids" class="text-xs text-dl-rejected">{{ errors.hcp_ids }}</span>
        </section>

        <div class="flex justify-end gap-2.5">
          <DlButton variant="ghost" :to="back">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton variant="dark" icon-end="tabler-arrow-right" :disabled="!count" @click="openWhen">{{ t('campaignSendings.new.next') }}</DlButton>
        </div>
      </template>
    </template>

    <DlSheet v-model:open="whenOpen" size="lg" :title="t('campaignSendings.when.title')" :description="t('campaignSendings.when.description', { count: n(count) })">
      <div class="flex flex-col gap-4">
        <button type="button" class="flex items-start gap-3 rounded-2xl border-[1.5px] p-3.5 text-start" :class="now ? 'border-dl-ink ring-3 ring-dl-mist' : 'border-dl-line'" :aria-pressed="now" @click="now = true">
          <span class="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-2" :class="now ? 'border-[5px] border-dl-ink' : 'border-dl-muted'" />
          <span><strong class="block text-sm">{{ t('campaignSendings.when.now') }}</strong><span class="text-[13px] text-dl-muted">{{ t('campaignSendings.when.nowHint') }}</span></span>
        </button>
        <div class="flex flex-col gap-3 rounded-2xl border-[1.5px] p-3.5" :class="!now ? 'border-dl-ink ring-3 ring-dl-mist' : 'border-dl-line'">
          <button type="button" class="flex items-start gap-3 text-start" :aria-pressed="!now" @click="now = false">
            <span class="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-2" :class="!now ? 'border-[5px] border-dl-ink' : 'border-dl-muted'" />
            <span><strong class="block text-sm">{{ t('campaignSendings.when.later') }}</strong><span v-if="campaign" class="text-[13px] text-dl-muted">{{ t('campaignSendings.when.laterHint', { start: messageText.date(campaign.start_date), end: messageText.date(campaign.end_date) }) }}</span></span>
          </button>
          <div v-if="!now" class="grid grid-cols-[1fr_120px] gap-2.5">
            <DlDatePicker v-model="day" :label="t('campaignSendings.when.day')" :min="minDay" :max="campaign?.end_date" />
            <DlSelect v-model="hour" :label="t('campaignSendings.when.hour')" :options="HOURS" />
          </div>
          <span v-if="errors.scheduled_at" class="text-xs text-dl-rejected">{{ errors.scheduled_at }}</span>
        </div>

        <section v-if="quotaLeft !== null" class="flex flex-col gap-2 rounded-2xl border border-dl-line p-3.5">
          <div class="flex items-center gap-2 text-sm"><strong class="flex-1">{{ t('campaignSendings.quota.title') }}</strong><span class="text-xs text-dl-muted">{{ t('campaignSendings.quota.left', { left: n(quotaLeft), count: n(count) }) }}</span></div>
          <div class="flex h-2.5 overflow-hidden rounded-full bg-dl-line-soft">
            <span class="h-full" :class="tooMany ? 'bg-dl-rejected' : 'bg-dl-signal'" :style="{ width: `${Math.min(100, quotaLeft ? (count / quotaLeft) * 100 : 100)}%` }" />
          </div>
          <p v-if="tooMany" class="rounded-xl bg-dl-rejected/8 px-3 py-2 text-[12.5px] text-dl-rejected">{{ t('campaignSendings.quota.tooMany', { count: n(count), left: n(quotaLeft) }) }}</p>
        </section>
        <p class="text-xs text-dl-muted">{{ t('campaignSendings.when.note') }}</p>
        <span v-if="errors.hcp_ids || errors.campaign_message_id" class="text-xs text-dl-rejected">{{ errors.hcp_ids || errors.campaign_message_id }}</span>
      </div>
      <template #footer>
        <DlButton variant="ghost" @click="whenOpen = false">{{ t('campaignSendings.when.back') }}</DlButton>
        <DlButton variant="dark" class="ms-auto" :disabled="tooMany || (!now && !day)" :loading="saving" @click="launch">{{ now ? t('campaignSendings.when.sendNow') : t('campaignSendings.when.schedule') }}</DlButton>
      </template>
    </DlSheet>
  </div>
</template>

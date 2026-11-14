<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { deleteCampaign, fetchCampaign, updateCampaign, type Campaign, type CampaignPayload } from '@/api/tenant/campaigns'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDateRangePicker from '@/components/DlDateRangePicker.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTabs from '@/components/DlTabs.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import CoachingRolePicks from '@/views/tenant/coaching/CoachingRolePicks.vue'
import CampaignGrid from './CampaignGrid.vue'
import CampaignMessagesTab from './messages/CampaignMessagesTab.vue'
import CampaignSendingsTab from './sendings/CampaignSendingsTab.vue'
import { brandInitials, campaignProgress, STATE_TONE, useCampaignText } from './campaignDisplay'
import { useCampaignLookups } from './useCampaignLookups'

// A campaign's page: a header card (code, state, name, objective, teams, the date bar) and one tab per part. 12a has
// "La campagne" and "Grille promo", 12b "Emails & SMS" (for who writes or approves them); sendings, materials, events
// and actions add their tabs with their modules.
// Mockup: docs/design/campaigns-mockups/Campaigns.html (frames 3 to 9)
const props = defineProps<{ id: string }>()
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useCampaignText()
const { teams: teamOptions } = useCampaignLookups()
const canEdit = computed(() => auth.can('campaigns.update'))

const campaign = ref<Campaign | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    campaign.value = await fetchCampaign(Number(props.id))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { campaign.value = null; load() }, { immediate: true })

// The tab is kept in the address (?tab=grid), so a reload or a shared link opens the same tab.
const seesMessages = computed(() => auth.can('campaigns.update') || auth.can('campaign-messages.approve'))
const TABS = ['campaign', 'grid', 'messages', 'sendings']
const tab = computed({
  get: () => {
    const asked = String(route.query.tab ?? '')
    return TABS.includes(asked) && (!['messages', 'sendings'].includes(asked) || seesMessages.value) ? asked : 'campaign'
  },
  set: value => router.replace({ query: { ...route.query, tab: value === 'campaign' ? undefined : value } }),
})
const tabs = computed(() => [
  { value: 'campaign', label: t('campaigns.tabs.campaign') },
  { value: 'grid', label: `${t('campaigns.tabs.grid')} · ${n(campaign.value?.figures?.ticks ?? 0)}` },
  ...(seesMessages.value ? [
    { value: 'messages', label: `${t('campaigns.tabs.messages')} · ${n(campaign.value?.messages_count ?? 0)}` },
    { value: 'sendings', label: `${t('campaigns.tabs.sendings')} · ${n(campaign.value?.sendings_count ?? 0)}` },
  ] : []),
])

const progress = computed(() => (campaign.value ? campaignProgress(campaign.value.start_date, campaign.value.end_date) : null))
const progressText = computed(() => {
  const row = campaign.value
  if (!row || !progress.value) return ''
  if (row.state === 'upcoming') return t('campaigns.page.startsIn', progress.value.total)
  if (row.state === 'ended') return t('campaigns.page.ended')
  return t('campaigns.page.today', { day: n(progress.value.day), total: n(progress.value.total), left: n(progress.value.left) })
})

// "Ce que la grille promeut": one bar per brand, split by priority; the longest brand fills the width.
const most = computed(() => Math.max(1, ...(campaign.value?.promoted ?? []).map(row => row.ticks)))
const priorityCounts = (row: NonNullable<Campaign['promoted']>[number]) =>
  row.by_priority.filter(part => part.priority).map(part => `${n(part.count)} ${part.priority!.name}`).join(' · ')

// One card in edit at a time.
type Card = 'campaign' | 'teams'
const editing = ref<Card | null>(null)
const form = ref({ name: '', start_date: '', end_date: '', objective: '', comment: '', team_ids: [] as number[] })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function edit(card: Card | null) {
  const row = campaign.value
  if (!row) return
  form.value = { name: row.name, start_date: row.start_date, end_date: row.end_date, objective: row.objective, comment: row.comment ?? '', team_ids: row.teams.map(team => team.id) }
  errors.value = {}
  editing.value = card
}
const editingCard = (card: Card) => computed({ get: () => editing.value === card, set: value => edit(value ? card : null) })
const editCampaign = editingCard('campaign')
const editTeams = editingCard('teams')

async function save(card: Card) {
  if (!campaign.value) return
  errors.value = {}
  saving.value = true
  try {
    const payload: CampaignPayload = card === 'teams'
      ? { team_ids: form.value.team_ids }
      : { name: form.value.name, start_date: form.value.start_date, end_date: form.value.end_date, objective: form.value.objective, comment: form.value.comment.trim() || null }
    campaign.value = await updateCampaign(campaign.value.id, payload)
    editing.value = null
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}

async function remove() {
  if (!campaign.value) return
  const ok = await confirm({
    title: t('campaigns.page.deleteTitle', { name: campaign.value.name }),
    text: t('campaigns.page.deleteText', campaign.value.figures?.ticks ?? 0),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteCampaign(campaign.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-campaigns' })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

const TILES = [
  { key: 'ticks', icon: 'tabler-check', tone: 'bg-dl-teal/15 text-dl-teal' },
  { key: 'brands', icon: 'tabler-pill', tone: 'bg-dl-cobalt/10 text-dl-cobalt' },
  { key: 'specialities', icon: 'tabler-stethoscope', tone: 'bg-dl-pending/15 text-dl-pending' },
  { key: 'with_message', icon: 'tabler-message', tone: 'bg-dl-rejected/10 text-dl-rejected' },
  { key: 'emails_sent', icon: 'tabler-send', tone: 'bg-dl-ink/10 text-dl-fg' },
] as const
const LATER = [
  { icon: 'tabler-package', key: 'materials', module: '13' },
  { icon: 'tabler-calendar-event', key: 'events', module: '14' },
  { icon: 'tabler-flag', key: 'actions', module: '15' },
]
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('campaigns.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-campaigns' }">{{ t('campaigns.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!campaign">
      <DlSkeleton class="h-44 rounded-3xl" />
      <div class="grid gap-4 lg:grid-cols-4"><DlSkeleton v-for="i in 4" :key="i" class="h-20 rounded-3xl" /></div>
    </template>

    <template v-else>
      <!-- Header card: code, state, name, objective, teams with their people, and where today sits in the dates. -->
      <section class="flex flex-col gap-4 rounded-3xl bg-dl-paper p-5 md:p-6">
        <div class="flex flex-wrap items-center gap-2.5">
          <span class="rounded-full bg-dl-signal px-3 py-1 text-xs font-bold text-dl-ink">{{ campaign.code }}</span>
          <DlBadge size="sm" :tone="STATE_TONE[campaign.state]" dot>{{ text.state(campaign.state) }}</DlBadge>
          <nav class="flex items-center gap-1.5 text-[13px] text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
            <RouterLink :to="{ name: 'tenant-campaigns' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('campaigns.list.title') }}</RouterLink>
          </nav>
          <DlButton v-if="auth.can('campaigns.delete')" variant="outline" size="sm" icon="tabler-trash" class="ms-auto" @click="remove">{{ t('common.actions.delete') }}</DlButton>
        </div>
        <div class="flex flex-wrap items-end gap-6">
          <div class="flex min-w-0 flex-1 flex-col gap-2.5">
            <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[36px]">{{ campaign.name }}</h1>
            <p class="border-s-[3px] border-dl-line ps-3 text-[15px] text-dl-body">{{ campaign.objective }}</p>
          </div>
          <div class="flex flex-wrap gap-5">
            <div v-for="team in campaign.teams" :key="team.id" class="flex flex-col items-start gap-1.5">
              <div class="flex">
                <DlAvatar v-for="(person, i) in team.members" :key="person.id" :name="person.full_name" size="sm" :tone="i % 2 ? 'neutral' : 'cobalt'" class="-ms-2 ring-2 ring-dl-paper first:ms-0" />
                <span v-if="(team.members_count ?? 0) > (team.members?.length ?? 0)" class="-ms-2 flex h-8 min-w-8 items-center justify-center rounded-full bg-dl-line-soft px-1.5 text-[11px] font-bold text-dl-body ring-2 ring-dl-paper">
                  +{{ (team.members_count ?? 0) - (team.members?.length ?? 0) }}
                </span>
              </div>
              <span class="text-xs text-dl-muted">{{ team.name }}</span>
            </div>
          </div>
        </div>
        <div v-if="progress">
          <div class="relative h-2.5 rounded-full bg-dl-line-soft" role="progressbar" :aria-valuenow="Math.round(progress.percent)" aria-valuemin="0" aria-valuemax="100" :aria-label="progressText">
            <div class="absolute inset-y-0 start-0 rounded-full bg-dl-ink" :style="{ width: `${progress.percent}%` }" />
            <div v-if="campaign.state === 'current'" class="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-dl-paper bg-dl-ink rtl:translate-x-1/2" :style="{ insetInlineStart: `${progress.percent}%` }" />
          </div>
          <div class="mt-2 flex justify-between gap-3 text-xs text-dl-muted">
            <span>{{ text.date(campaign.start_date) }}</span>
            <strong class="text-center text-dl-fg">{{ progressText }}</strong>
            <span>{{ text.date(campaign.end_date) }}</span>
          </div>
        </div>
      </section>

      <DlTabs v-model="tab" :label="t('campaigns.tabs.label')" :items="tabs">
        <template #campaign>
          <div class="flex flex-col gap-4 pt-1">
            <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <div v-for="tile in TILES" :key="tile.key" class="flex items-center gap-3.5 rounded-3xl bg-dl-paper p-4">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" :class="tile.tone"><DlIcon :icon="tile.icon" :size="20" /></span>
                <div>
                  <strong class="block font-display text-[26px] leading-none">{{ n(campaign.figures?.[tile.key] ?? 0) }}</strong>
                  <span class="text-xs text-dl-muted">{{ t(`campaigns.figures.${tile.key}`) }}</span>
                </div>
              </div>
            </div>

            <div class="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
              <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
                <header class="flex items-center gap-2">
                  <h2 class="flex-1 text-[15px] font-semibold">{{ t('campaigns.promoted.title') }}</h2>
                  <DlButton size="sm" variant="outline" icon-end="tabler-arrow-right" @click="tab = 'grid'">{{ t('campaigns.promoted.open') }}</DlButton>
                </header>
                <p v-if="!campaign.promoted?.length" class="py-4 text-[13px] text-dl-muted">{{ t('campaigns.promoted.none') }}</p>
                <div v-for="row in campaign.promoted" :key="row.brand.id" class="flex items-center gap-3 py-1.5">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dl-mist font-display text-[13px] font-extrabold">{{ brandInitials(row.brand.name) }}</span>
                  <strong class="w-32 truncate text-sm">{{ row.brand.name }}</strong>
                  <div class="flex h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-dl-line-soft">
                    <div class="flex h-full" :style="{ width: `${(row.ticks / most) * 100}%` }">
                      <span v-for="(part, i) in row.by_priority" :key="i" class="h-full" :style="{ width: `${(part.count / row.ticks) * 100}%`, background: part.priority?.color ?? 'var(--color-dl-ink)' }" />
                    </div>
                  </div>
                  <span class="w-28 text-end text-xs text-dl-muted">{{ priorityCounts(row) || t('campaigns.promoted.ticks', row.ticks) }}</span>
                </div>
              </section>

              <div class="flex flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-5">
                <DlRecordSection v-model:editing="editCampaign" :title="t('campaigns.page.campaign')" icon="tabler-speakerphone" :can-edit="canEdit" :saving="saving" @save="save('campaign')" @cancel="edit(null)">
                  <dl class="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
                    <dt class="text-dl-muted">{{ t('campaigns.fields.name') }}</dt><dd>{{ campaign.name }}</dd>
                    <dt class="text-dl-muted">{{ t('campaigns.columns.dates') }}</dt><dd>{{ text.period(campaign.start_date, campaign.end_date) }}</dd>
                    <dt class="text-dl-muted">{{ t('campaigns.fields.objective') }}</dt><dd>{{ campaign.objective }}</dd>
                    <dt class="text-dl-muted">{{ t('campaigns.fields.comment') }}</dt><dd class="whitespace-pre-line">{{ campaign.comment || '—' }}</dd>
                    <template v-if="campaign.created_by">
                      <dt class="text-dl-muted">{{ t('campaigns.page.added') }}</dt>
                      <dd>{{ t('campaigns.page.addedBy', { name: campaign.created_by.full_name, date: text.date(campaign.created_at) }) }}</dd>
                    </template>
                  </dl>
                  <template #edit>
                    <DlInput v-model="form.name" :label="t('campaigns.fields.name')" :error="errors.name" />
                    <DlDateRangePicker v-model:start="form.start_date" v-model:end="form.end_date" :label="t('campaigns.columns.dates')" :error="errors.start_date || errors.end_date || errors.team_ids" />
                    <DlInput v-model="form.objective" :label="t('campaigns.fields.objective')" :error="errors.objective" />
                    <DlTextarea v-model="form.comment" :label="t('campaigns.fields.comment')" :rows="3" :error="errors.comment" />
                  </template>
                </DlRecordSection>

                <DlRecordSection v-model:editing="editTeams" :title="t('campaigns.fields.teams')" icon="tabler-users-group" :can-edit="canEdit" :saving="saving" @save="save('teams')" @cancel="edit(null)">
                  <div class="flex flex-col gap-3">
                    <div v-for="team in campaign.teams" :key="team.id" class="flex items-center gap-3">
                      <div class="min-w-0 flex-1">
                        <strong class="block text-sm">{{ team.name }}</strong>
                        <span class="text-xs text-dl-muted">{{ (team.specialities ?? []).map(row => row.name).join(', ') }}</span>
                      </div>
                      <DlBadge size="sm" tone="success">{{ t('campaigns.promoted.ticks', team.ticks_count ?? 0) }}</DlBadge>
                    </div>
                  </div>
                  <template #edit>
                    <CoachingRolePicks v-model="form.team_ids" :label="t('campaigns.fields.teams')" :add-label="t('campaigns.fields.addTeam')" :options="teamOptions" :error="errors.team_ids" />
                  </template>
                </DlRecordSection>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div v-for="part in LATER" :key="part.key" class="flex items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-dl-line p-3.5 text-[13px] text-dl-muted">
                <DlIcon :icon="part.icon" :size="20" />
                <div><strong class="block text-dl-body">{{ t(`campaigns.later.${part.key}`) }}</strong>{{ t('campaigns.later.comes', { module: part.module }) }}</div>
              </div>
            </div>
          </div>
        </template>

        <template #grid>
          <div class="pt-1"><CampaignGrid :campaign="campaign" :can-edit="canEdit" @changed="load" /></div>
        </template>

        <template v-if="seesMessages" #messages>
          <div class="pt-1"><CampaignMessagesTab :campaign-id="campaign.id" @changed="load" /></div>
        </template>

        <template v-if="seesMessages" #sendings>
          <div class="pt-1"><CampaignSendingsTab :campaign-id="campaign.id" :ended="campaign.state === 'ended'" /></div>
        </template>
      </DlTabs>
    </template>
  </div>
</template>

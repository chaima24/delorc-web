<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  closeEvent, deleteEvent, fetchEvent, fetchParticipant, refuseEvent, reopenEvent, saveParticipant, updateEvent, validateEvent,
  type EventParticipant, type LabEvent,
} from '@/api/tenant/events'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTabs from '@/components/DlTabs.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import CoachingReasonSheet from '@/views/tenant/coaching/CoachingReasonSheet.vue'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import EventFields from './EventFields.vue'
import EventMyPart from './EventMyPart.vue'
import { STATUS_TONE, useEventText } from './eventDisplay'
import { eventToForm, formToPayload, type EventForm } from './eventForm'

// An event's page (docs/api/events.md, mockup frames 5 to 11): the state and its steps, six figures, then tabs:
// participants (the organiser answers « a participé » for someone who didn't), the invited and the materials of
// everyone, « Ma participation » for a participant, the details edited in place, the history. Validate / refuse for who
// decides, close for the organiser or marketing, reopen for admins.
const props = defineProps<{ id: string }>()
const { t, n, d } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useEventText()

const event = ref<LabEvent | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    event.value = await fetchEvent(Number(props.id))
    parts.value = null
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { event.value = null; load() }, { immediate: true })

const can = computed(() => event.value?.can)
const started = computed(() => !!event.value && new Date(event.value.start_at.replace(' ', 'T')) <= new Date())

const TABS = ['participants', 'invited', 'materials', 'mine', 'details', 'history']
const tab = computed({
  get: () => {
    const asked = String(route.query.tab ?? '')
    return TABS.includes(asked) && (asked !== 'mine' || can.value?.fill) ? asked : 'participants'
  },
  set: value => router.replace({ query: { ...route.query, tab: value === 'participants' ? undefined : value } }),
})
const tabs = computed(() => {
  const f = event.value?.figures
  return [
    { value: 'participants', label: `${t('events.tabs.participants')} · ${n(f?.participants ?? 0)}` },
    ...(can.value?.fill ? [{ value: 'mine', label: t('events.tabs.mine') }] : []),
    { value: 'invited', label: `${t('events.tabs.invited')} · ${n(f?.invited ?? 0)}` },
    { value: 'materials', label: t('events.tabs.materials') },
    { value: 'details', label: t('events.tabs.details') },
    { value: 'history', label: t('events.tabs.history') },
  ]
})

// Everyone's part (invited and materials tabs), read when one of those tabs opens.
const parts = ref<EventParticipant[] | null>(null)
watch([tab, event], async () => {
  if (!event.value || parts.value || !['invited', 'materials'].includes(tab.value)) return
  try {
    parts.value = await Promise.all((event.value.participants ?? []).map(p => fetchParticipant(event.value!.id, p.user.id)))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}, { immediate: true })
const invitedRows = computed(() => (parts.value ?? []).flatMap(part => (part.invites ?? []).map(invite => ({ ...invite, by: part.user.full_name }))))
const materialRows = computed(() => (parts.value ?? []).flatMap(part => (part.materials ?? []).map(line => ({ ...line, by: part.user.full_name }))))
const sponsoring = computed(() => auth.hasFeature('events.sponsoring'))

const tiles = computed(() => {
  const f = event.value?.figures
  if (!f) return []
  return [
    { value: n(f.participants), label: t('events.tiles.participants', { count: n(f.attended) }) },
    { value: n(f.invited), label: t('events.tiles.invited') },
    { value: n(f.present), label: t('events.tiles.present', { percent: f.invited ? Math.round((f.present / f.invited) * 100) : 0 }) },
    { value: text.money(f.costs), label: t('events.tiles.budget') },
    { value: text.money(f.real), label: f.sponsored ? t('events.tiles.realSponsored', { amount: text.money(f.sponsored), gap: text.money(f.gap) }) : t('events.tiles.real', { gap: text.money(f.gap) }), bad: f.gap < 0 },
    { value: f.per_present == null ? '—' : text.money(Math.round(f.per_present)), label: t('events.tiles.perPresent') },
  ]
})
const steps = computed(() => {
  const status = event.value?.status
  const first = event.value?.decided_by || status !== 'validated' ? 'proposed' : 'created'
  return [
    { key: first, done: status !== 'proposed' },
    { key: status === 'refused' ? 'refused' : 'validated', done: status === 'closed', on: status === 'validated' || status === 'refused' },
    { key: 'closed', done: false, on: status === 'closed' },
  ]
})

const partColumns = computed(() => [
  { key: 'person', label: t('events.columns.participant') },
  { key: 'attended', label: t('events.part.attended') },
  { key: 'hours', label: t('events.part.hours'), secondary: true },
  { key: 'rating', label: t('events.part.rating') },
  { key: 'cost', label: t('events.part.cost'), align: 'end' as const },
  { key: 'invited', label: t('events.columns.invited'), align: 'end' as const },
  { key: 'materials', label: t('events.tabs.materials'), align: 'end' as const, secondary: true },
])
const answering = ref<number | null>(null)
async function answer(part: EventParticipant, attended: boolean) {
  if (!event.value) return
  answering.value = part.user.id
  try {
    await saveParticipant(event.value.id, part.user.id, { attended })
    await load()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    answering.value = null
  }
}

// The moves.
const busy = ref(false)
async function run(action: () => Promise<LabEvent>, done: string) {
  busy.value = true
  try {
    event.value = await action()
    parts.value = null
    toast.success(done)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    busy.value = false
  }
}
const validate = () => run(() => validateEvent(event.value!.id), t('events.page.validated'))
const reopen = () => run(() => reopenEvent(event.value!.id), t('events.page.reopened'))
async function close() {
  const waiting = (event.value?.participants ?? []).filter(p => p.attended == null)
  if (waiting.length) {
    toast.error(t('events.page.closeWaiting', { names: waiting.map(p => p.user.full_name).join(', ') }, waiting.length))
    return
  }
  if (await confirm({ title: t('events.page.closeTitle', { name: event.value!.name }), text: t('events.page.closeText'), confirmButtonText: t('events.page.close') })) {
    await run(() => closeEvent(event.value!.id), t('events.page.closed'))
  }
}
const refusing = ref(false)
const refuseError = ref('')
async function refuse(reason: string) {
  refuseError.value = ''
  busy.value = true
  try {
    event.value = await refuseEvent(event.value!.id, reason)
    refusing.value = false
    toast.success(t('events.page.refused'))
  }
  catch (error) {
    refuseError.value = fieldErrors(error).reason ?? errorMessage(error) ?? t('studio.list.toast.failed')
  }
  finally {
    busy.value = false
  }
}
async function remove() {
  if (!event.value) return
  const ok = await confirm({ title: t('events.page.deleteTitle', { name: event.value.name }), text: t('events.page.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteEvent(event.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-events' })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

// The details card, edited in place.
const editing = ref(false)
const form = ref<EventForm | null>(null)
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const editModel = computed({
  get: () => editing.value,
  set: value => {
    if (value && event.value) form.value = eventToForm(event.value)
    errors.value = {}
    editing.value = value
  },
})
async function save() {
  if (!event.value || !form.value) return
  errors.value = {}
  saving.value = true
  try {
    event.value = await updateEvent(event.value.id, formToPayload(form.value))
    editing.value = false
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
const when = (value: string) => d(new Date(value), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('events.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-events' }">{{ t('events.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!event">
      <DlSkeleton class="h-40 rounded-3xl" />
      <div class="grid gap-4 lg:grid-cols-6"><DlSkeleton v-for="i in 6" :key="i" class="h-20 rounded-3xl" /></div>
    </template>

    <template v-else>
      <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-5 md:p-6">
        <div class="flex flex-wrap items-center gap-2.5">
          <DlBadge size="sm" :tone="STATUS_TONE[event.status]" dot>{{ text.status(event.status) }}</DlBadge>
          <RouterLink v-if="event.campaign" :to="{ name: 'tenant-campaign', params: { id: event.campaign.id }, query: { tab: 'events' } }" class="rounded-full bg-dl-mist px-2.5 py-0.5 text-xs no-underline">{{ event.campaign.name }}</RouterLink>
          <nav class="flex items-center gap-1.5 text-[13px] text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
            <RouterLink :to="{ name: 'tenant-events' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('events.list.title') }}</RouterLink>
          </nav>
          <div class="ms-auto flex flex-wrap gap-2">
            <DlButton v-if="can?.delete" variant="outline" size="sm" icon="tabler-trash" @click="remove">{{ t('common.actions.delete') }}</DlButton>
            <template v-if="can?.validate">
              <DlButton variant="outline" size="sm" :disabled="busy" @click="refusing = true">{{ t('events.page.refuse') }}</DlButton>
              <DlButton variant="dark" size="sm" :loading="busy" @click="validate">{{ t('events.page.validate') }}</DlButton>
            </template>
            <DlButton v-if="can?.close && started" variant="dark" size="sm" :loading="busy" @click="close">{{ t('events.page.close') }}</DlButton>
            <DlButton v-if="can?.reopen" variant="outline" size="sm" icon="tabler-rotate" :loading="busy" @click="reopen">{{ t('events.page.reopen') }}</DlButton>
          </div>
        </div>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[34px]">{{ event.name }}</h1>
        <p class="text-[13px] text-dl-muted">
          {{ [event.event_type.name, text.period(event.start_at, event.end_at), [event.wilaya.name, event.place].filter(Boolean).join(', '), text.target(event.type)].join(' · ') }}
          · {{ t('events.page.organisedBy', { name: event.organiser.full_name, date: text.day(event.created_at.slice(0, 10)) }) }}
        </p>
        <a v-if="event.online_url" :href="event.online_url" target="_blank" rel="noopener" class="self-start text-[13px]">{{ event.online_url }}</a>
        <div class="flex flex-wrap items-center gap-2 text-[13px]">
          <template v-for="(step, i) in steps" :key="i">
            <span v-if="i" class="text-dl-muted">→</span>
            <span class="rounded-full px-2.5 py-1 font-semibold" :class="step.on ? 'bg-dl-ink text-dl-signal' : step.done || i === 0 ? 'bg-dl-signal-soft' : 'bg-dl-mist text-dl-muted'">{{ t(`events.steps.${step.key}`) }}</span>
          </template>
        </div>
        <p v-if="event.status === 'refused' && event.refusal_reason" class="rounded-xl bg-dl-rejected/10 px-3 py-2 text-[13px] text-dl-rejected">
          {{ t('events.page.refusedBy', { name: event.decided_by?.full_name ?? '—' }) }} — « {{ event.refusal_reason }} »
        </p>
        <p v-if="event.status === 'proposed'" class="rounded-xl bg-dl-pending/10 px-3 py-2 text-[13px]">{{ t('events.page.waiting') }}</p>
      </section>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div v-for="tile in tiles" :key="tile.label" class="flex flex-col gap-1 rounded-3xl bg-dl-paper p-4">
          <strong class="font-display text-[22px] leading-none" :class="tile.bad && 'text-dl-rejected'">{{ tile.value }}</strong>
          <span class="text-xs text-dl-muted">{{ tile.label }}</span>
        </div>
      </div>

      <DlTabs v-model="tab" :label="t('events.tabs.label')" :items="tabs">
        <template #participants>
          <div class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
            <DlDataList :label="t('events.tabs.participants')" :columns="partColumns" :rows="event.participants ?? []" :row-key="row => row.id" :empty-title="t('events.page.noParticipants')">
              <template #cell-person="{ row }">
                <strong class="block font-semibold">{{ row.user.full_name }}</strong>
                <span class="text-xs text-dl-muted">{{ row.user.role ? roleLabel(row.user.role) : '' }}</span>
              </template>
              <template #cell-attended="{ row }">
                <DlBadge v-if="row.attended != null" size="sm" :tone="row.attended ? 'success' : 'neutral'">{{ row.attended ? t('events.part.yes') : t('events.part.no') }}</DlBadge>
                <span v-else-if="can?.close && started && row.user.id !== auth.user?.id" class="flex gap-1">
                  <DlButton size="sm" variant="outline" :loading="answering === row.user.id" @click.stop="answer(row, true)">{{ t('events.part.yes') }}</DlButton>
                  <DlButton size="sm" variant="outline" :disabled="answering === row.user.id" @click.stop="answer(row, false)">{{ t('events.part.no') }}</DlButton>
                </span>
                <span v-else class="text-xs text-dl-muted">{{ t('events.part.notYet') }}</span>
              </template>
              <template #cell-hours="{ row }"><span class="whitespace-nowrap text-xs text-dl-muted">{{ row.attended ? text.period(row.start_at, row.end_at) : '—' }}</span></template>
              <template #cell-rating="{ row }"><span v-if="row.rating" class="text-dl-pending" :aria-label="t('events.part.stars', { count: row.rating }, row.rating)">{{ '★'.repeat(row.rating) }}<span class="text-dl-line">{{ '★'.repeat(5 - row.rating) }}</span></span><span v-else class="text-dl-muted">—</span></template>
              <template #cell-cost="{ row }"><span class="tabular-nums">{{ text.money(row.cost) }}</span></template>
              <template #cell-invited="{ row }"><span class="tabular-nums">{{ n(row.invited ?? 0) }} / {{ n(row.present ?? 0) }}</span></template>
              <template #cell-materials="{ row }"><span class="tabular-nums">{{ row.materials_count ? n(row.materials_count) : '—' }}</span></template>
              <template #card="{ row }">
                <strong class="block font-semibold">{{ row.user.full_name }}</strong>
                <span class="text-xs text-dl-muted">{{ row.attended == null ? t('events.part.notYet') : row.attended ? t('events.part.yes') : t('events.part.no') }} · {{ n(row.invited ?? 0) }} / {{ n(row.present ?? 0) }}</span>
              </template>
            </DlDataList>
            <p class="text-xs text-dl-muted">{{ t('events.page.participantsNote') }}</p>
          </div>
        </template>

        <template v-if="can?.fill" #mine><EventMyPart :event="event" @saved="load" /></template>

        <template #invited>
          <div class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
            <DlSkeleton v-if="!parts" class="h-40 rounded-2xl" />
            <p v-else-if="!invitedRows.length" class="py-4 text-[13px] text-dl-muted">{{ t('events.part.noInvites') }}</p>
            <table v-else class="w-full text-sm">
              <thead class="text-xs text-dl-muted"><tr>
                <th class="py-1.5 text-start font-medium">{{ t('events.part.professional') }}</th>
                <th class="py-1.5 text-start font-medium">{{ t('events.columns.invitedBy') }}</th>
                <th class="py-1.5 text-start font-medium">{{ t('events.part.present') }}</th>
                <th v-if="sponsoring" class="py-1.5 text-end font-medium">{{ t('events.part.sponsored') }}</th>
              </tr></thead>
              <tbody>
                <tr v-for="row in invitedRows" :key="row.hcp.id" class="border-t border-dl-line-soft">
                  <td class="py-2"><RouterLink :to="{ name: 'tenant-hcp-detail', params: { id: row.hcp.id } }" class="font-semibold no-underline">{{ row.hcp.name }}</RouterLink>
                    <span class="block text-xs text-dl-muted">{{ [row.hcp.speciality, row.hcp.commune].filter(Boolean).join(' · ') }}</span></td>
                  <td>{{ row.by }}</td>
                  <td><DlBadge size="sm" :tone="row.present ? 'success' : 'neutral'">{{ row.present ? t('events.part.yes') : started ? t('events.part.no') : t('events.part.toCome') }}</DlBadge></td>
                  <td v-if="sponsoring" class="text-end tabular-nums">{{ row.sponsored ? text.money(row.sponsored_amount ?? null) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template #materials>
          <div class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
            <DlSkeleton v-if="!parts" class="h-32 rounded-2xl" />
            <p v-else-if="!materialRows.length" class="py-4 text-[13px] text-dl-muted">{{ t('events.page.noMaterials') }}</p>
            <table v-else class="w-full text-sm">
              <thead class="text-xs text-dl-muted"><tr>
                <th class="py-1.5 text-start font-medium">{{ t('events.columns.participant') }}</th>
                <th class="py-1.5 text-start font-medium">{{ t('materials.columns.materiel') }}</th>
                <th class="py-1.5 text-start font-medium">{{ t('materials.columns.campaign') }}</th>
                <th class="py-1.5 text-end font-medium">{{ t('events.page.taken') }}</th>
              </tr></thead>
              <tbody>
                <tr v-for="(row, i) in materialRows" :key="i" class="border-t border-dl-line-soft">
                  <td class="py-2">{{ row.by }}</td><td>{{ row.materiel.name }}</td><td>{{ row.campaign.name }}</td><td class="text-end tabular-nums">{{ n(row.quantity) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template #details>
          <div class="rounded-3xl bg-dl-paper p-4 md:p-5">
            <DlRecordSection v-model:editing="editModel" :title="t('events.page.details')" icon="tabler-calendar-event" :can-edit="!!can?.update" :saving="saving" @save="save" @cancel="editModel = false">
              <dl class="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt class="text-dl-muted">{{ t('events.fields.name') }}</dt><dd>{{ event.name }}</dd>
                <dt class="text-dl-muted">{{ t('events.fields.type') }}</dt><dd>{{ event.event_type.name }}</dd>
                <dt class="text-dl-muted">{{ t('events.fields.campaign') }}</dt><dd>{{ event.campaign ? `${event.campaign.code} · ${event.campaign.name}` : '—' }}</dd>
                <dt class="text-dl-muted">{{ t('events.fields.dates') }}</dt><dd>{{ text.period(event.start_at, event.end_at) }}</dd>
                <dt class="text-dl-muted">{{ t('events.fields.wilaya') }}</dt><dd>{{ event.wilaya.name }}</dd>
                <dt class="text-dl-muted">{{ t('events.fields.place') }}</dt><dd>{{ event.place || '—' }}</dd>
                <dt class="text-dl-muted">{{ t('events.fields.onlineUrl') }}</dt><dd class="break-all">{{ event.online_url || '—' }}</dd>
                <dt class="text-dl-muted">{{ t('events.fields.target') }}</dt><dd>{{ text.target(event.type) }}</dd>
                <dt class="text-dl-muted">{{ t('events.fields.specialities') }}</dt><dd>{{ event.specialities?.length ? event.specialities.map(s => s.name).join(', ') : t('events.fields.specialitiesAll') }}</dd>
                <dt class="text-dl-muted">{{ t('events.fields.costs') }}</dt><dd>{{ text.money(event.costs) }}</dd>
                <dt class="text-dl-muted">{{ t('events.fields.object') }}</dt><dd class="whitespace-pre-line">{{ event.object || '—' }}</dd>
              </dl>
              <template #edit>
                <EventFields v-if="form" v-model="form" :errors="errors" :manage="auth.can('events.manage')" />
              </template>
            </DlRecordSection>
          </div>
        </template>

        <template #history>
          <div class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
            <p v-if="!event.history?.length" class="text-[13px] text-dl-muted">—</p>
            <div v-for="(line, i) in event.history" :key="i" class="flex gap-3 border-b border-dl-line-soft py-2 text-sm last:border-0">
              <span class="w-40 shrink-0 text-xs text-dl-muted">{{ when(line.at) }}</span>
              <span>{{ t(`events.history.${line.event}`, { name: line.by ?? '—' }) }}<template v-if="line.reason"> — « {{ line.reason }} »</template></span>
            </div>
          </div>
        </template>
      </DlTabs>

      <CoachingReasonSheet v-if="refusing" v-model:open="refusing" :title="t('events.page.refuseTitle', { name: event.name })" :text="t('events.page.refuseText')"
        :confirm-label="t('events.page.refuse')" :saving="busy" :error="refuseError" @confirm="refuse" />
    </template>
  </div>
</template>

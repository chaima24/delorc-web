<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { HCP_TYPES, dismissHcpDuplicates, fetchHcpDuplicateGroups, type Hcp, type HcpDuplicateGroup, type HcpDuplicateGroupsResponse, type HcpDuplicateReason, type HcpType } from '@/api/tenant/hcps'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { avatarName, useHcpText } from '../hcpForm'
import { useHcpLookups } from '../useHcpLookups'

// Possible duplicates: one card per group (same name, phone or e-mail) with what each record has, so you
// see which one to keep. "Merge…" opens the merge page for two of them; "Not the same" hides the group.
// Mockup: docs/design/customers-mockups/HcpDuplicates.html (frame 2)
const { t, n } = useI18n()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const text = useHcpText()
const lookups = useHcpLookups()

const ALL = 'all'
const filters = reactive({ reason: ALL, type: ALL, wilaya: ALL as string | number })
const page = ref(1)
const perPage = ref(25)
const groups = shallowRef<HcpDuplicateGroup[]>([])
const meta = ref<HcpDuplicateGroupsResponse['meta'] | null>(null)
const loading = ref(true)

let request = 0
async function load() {
  const current = ++request
  loading.value = true
  try {
    const data = await fetchHcpDuplicateGroups({
      page: page.value,
      per_page: perPage.value,
      'filter[reason]': filters.reason === ALL ? undefined : filters.reason as HcpDuplicateReason,
      'filter[type]': filters.type === ALL ? undefined : filters.type as HcpType,
      'filter[wilaya_id]': filters.wilaya === ALL ? undefined : Number(filters.wilaya),
    })
    if (current !== request) return
    groups.value = data.data
    meta.value = data.meta
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    if (current === request) loading.value = false
  }
}
watch(() => ({ ...filters }), () => {
  if (page.value === 1) load()
  else page.value = 1
})
watch([page, perPage], load, { immediate: true })

const reasons = computed(() => (['all', 'name', 'phone', 'email'] as const).map(value => ({
  value,
  label: t(`hcps.duplicates.reasons.${value}`),
  count: meta.value?.counts[value],
})))
const typeOptions = computed(() => [{ value: ALL, label: t('hcps.filter.all') }, ...HCP_TYPES.map(type => ({ value: type, label: t(`hcps.types.${type}`) }))])
const wilayaOptions = computed(() => [{ value: ALL, label: t('hcps.filter.all') }, ...lookups.wilayaOptions.value])

const history = (hcp: Hcp) => (hcp.usage?.visits ?? 0) + (hcp.usage?.orders ?? 0) + (hcp.usage?.cycle_targets ?? 0)
/** The one to keep first: most history, then the oldest. */
const byHistory = (members: Hcp[]) => [...members].sort((a, b) => history(b) - history(a) || a.id - b.id)

// Groups of 3 or more: pick the two to merge (the two with most history by default).
const picked = reactive<Record<string, number[]>>({})
const pickedOf = (group: HcpDuplicateGroup) => picked[group.key] ?? byHistory(group.members).slice(0, 2).map(m => m.id)
function togglePick(group: HcpDuplicateGroup, id: number) {
  const current = pickedOf(group)
  picked[group.key] = current.includes(id) ? current.filter(x => x !== id) : [...current, id].slice(-2)
}
function merge(group: HcpDuplicateGroup) {
  const ids = pickedOf(group)
  if (ids.length !== 2) return
  const [keep, other] = byHistory(group.members.filter(m => ids.includes(m.id)))
  if (!keep || !other) return
  router.push({ name: 'tenant-hcp-merge', params: { keep: keep.id, other: other.id } })
}

async function notTheSame(group: HcpDuplicateGroup) {
  try {
    await dismissHcpDuplicates(group.members.map(m => m.id))
    toast.success(t('hcps.duplicates.dismissed'))
    load()
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}

const facts = (hcp: Hcp) => [
  hcp.usage?.visits ? t('hcps.duplicates.visits', { n: n(hcp.usage.visits) }, hcp.usage.visits) : null,
  hcp.usage?.orders ? t('hcps.duplicates.orders', { n: n(hcp.usage.orders) }, hcp.usage.orders) : null,
  hcp.usage?.cycle_targets ? t('hcps.duplicates.cycles', { n: n(hcp.usage.cycle_targets) }, hcp.usage.cycle_targets) : null,
  t('hcps.page.added', { date: text.date(hcp.created_at) }),
].filter(Boolean).join(' · ')
const subLine = (hcp: Hcp) => [text.code(hcp), text.mainWorkplace(hcp).speciality, hcp.commune?.name, hcp.phone || hcp.email].filter(Boolean).join(' · ')
// Merging has its own right (decided 2026-11-10).
const canMerge = computed(() => auth.can('hcps.merge'))
</script>

<template>
  <div class="flex w-full flex-col gap-5 pb-10">
    <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex flex-wrap items-center gap-1.5 text-sm text-dl-muted">
      <span>{{ t('nav.workspaces.customers') }}</span>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <RouterLink :to="{ name: 'tenant-hcps' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('hcps.title') }}</RouterLink>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <span>{{ t('hcps.duplicates.title') }}</span>
    </nav>

    <div class="flex flex-wrap items-end justify-between gap-3">
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[34px]">{{ t('hcps.duplicates.title') }}</h1>
      <span class="text-xs text-dl-muted">{{ t('hcps.duplicates.how') }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <div role="radiogroup" :aria-label="t('hcps.duplicates.reason')" class="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:rounded-xl md:bg-dl-line-soft md:p-1">
        <button
          v-for="reason in reasons"
          :key="reason.value"
          type="button"
          role="radio"
          :aria-checked="filters.reason === reason.value"
          class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
          :class="filters.reason === reason.value ? 'bg-dl-ink text-dl-on-ink dark:bg-dl-fg dark:text-dl-mist' : 'text-dl-body hover:text-dl-fg max-md:bg-dl-paper'"
          @click="filters.reason = reason.value"
        >
          {{ reason.label }}<span v-if="reason.count !== undefined" class="tabular-nums opacity-70">{{ n(reason.count) }}</span>
        </button>
      </div>
      <DlSelect v-model="filters.type" :label="t('hcps.fields.type')" :options="typeOptions" appearance="filter" />
      <DlSelect v-model="filters.wilaya" :label="t('hcps.fields.wilaya')" :options="wilayaOptions" appearance="filter" />
    </div>

    <div v-if="loading && !groups.length" class="flex flex-col gap-3" aria-hidden="true">
      <DlSkeleton v-for="i in 3" :key="i" class="h-36 rounded-[20px]" />
    </div>
    <DlEmptyState v-else-if="!groups.length" icon="tabler-copy-check" :title="t('hcps.duplicates.none')" :description="t('hcps.duplicates.noneText')" class="rounded-3xl bg-dl-paper" />

    <section v-for="group in groups" :key="group.key" class="flex flex-col gap-2.5 rounded-[20px] bg-dl-paper p-4" :aria-label="group.members.map(m => m.name).join(', ')">
      <header class="flex flex-wrap items-center gap-2">
        <DlBadge size="sm" tone="info">{{ group.reasons.map(reason => t(`hcps.duplicates.reasons.${reason}`)).join(' · ') }}</DlBadge>
        <span v-if="group.members.length > 2" class="text-xs text-dl-muted">{{ t('hcps.duplicates.pickTwo') }}</span>
        <span class="flex-1" />
        <DlButton v-if="canUpdate('hcps')" variant="ghost" size="sm" @click="notTheSame(group)">{{ t('hcps.duplicates.notSame') }}</DlButton>
        <DlButton v-if="canMerge" variant="dark" size="sm" :disabled="pickedOf(group).length !== 2" @click="merge(group)">{{ t('hcps.duplicates.merge') }}</DlButton>
      </header>
      <div class="grid gap-2.5 md:grid-cols-2">
        <component
          :is="group.members.length > 2 ? 'button' : 'div'"
          v-for="member in group.members"
          :key="member.id"
          :type="group.members.length > 2 ? 'button' : undefined"
          :aria-pressed="group.members.length > 2 ? pickedOf(group).includes(member.id) : undefined"
          class="flex gap-3 rounded-2xl border px-3 py-2.5 text-start text-[13px]"
          :class="group.members.length > 2 && pickedOf(group).includes(member.id) ? 'border-2 border-dl-fg' : 'border-dl-line'"
          @click="group.members.length > 2 && togglePick(group, member.id)"
        >
          <DlAvatar :name="avatarName(member.name)" size="sm" tone="neutral" />
          <span class="flex min-w-0 flex-1 flex-col">
            <RouterLink :to="{ name: 'tenant-hcp-detail', params: { id: member.id } }" target="_blank" class="truncate font-semibold text-dl-fg no-underline hover:underline" @click.stop>{{ member.name }}</RouterLink>
            <span class="truncate text-xs text-dl-muted">{{ subLine(member) }}</span>
            <span class="mt-1 text-xs text-dl-body">{{ facts(member) }}</span>
          </span>
        </component>
      </div>
    </section>

    <DlPagination v-if="(meta?.total ?? 0) > perPage" v-model="page" v-model:per-page="perPage" :total="meta?.total ?? 0" />
  </div>
</template>

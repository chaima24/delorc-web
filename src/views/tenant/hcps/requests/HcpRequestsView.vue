<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { HCP_TYPES, approveHcpRequest, fetchHcpRequests, refuseHcpRequest, type Hcp, type HcpRequestState, type HcpRequestsResponse, type HcpType } from '@/api/tenant/hcps'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useOrgTree } from '@/views/tenant/users/hierarchy/useOrgTree'
import { useUserText } from '@/views/tenant/users/userDisplay'
import { avatarName, useHcpText } from '../hcpForm'

// Requests (approvers): proposals of new professionals made by people who can't add them directly.
// Waiting / Refused / Approved; approve, refuse with a reason, or merge into a look-alike.
// Mockup: docs/design/customers-mockups/HcpRequests.html (frames 3–4)
const { t, n } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const text = useHcpText()
const userText = useUserText()
// Who proposed: everyone of the lab (the hierarchy's shared list).
const { people: users } = useOrgTree()

const ALL = 'all'
const filters = reactive({ state: 'waiting' as HcpRequestState, addedBy: ALL as string | number, type: ALL })
const page = ref(1)
const perPage = ref(25)
const rows = shallowRef<Hcp[]>([])
const meta = ref<HcpRequestsResponse['meta'] | null>(null)
const loading = ref(true)

let request = 0
async function load() {
  const current = ++request
  loading.value = true
  try {
    const data = await fetchHcpRequests({
      page: page.value,
      per_page: perPage.value,
      'filter[state]': filters.state,
      'filter[added_by]': filters.addedBy === ALL ? undefined : Number(filters.addedBy),
      'filter[type]': filters.type === ALL ? undefined : filters.type as HcpType,
    })
    if (current !== request) return
    rows.value = data.data
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

const states = computed(() => (['waiting', 'refused', 'approved'] as const).map(value => ({ value, label: t(`hcps.requests.states.${value}`), count: meta.value?.counts[value] })))
const userOptions = computed(() => [
  { value: ALL, label: t('hcps.filter.all') },
  ...users.items.value.map(user => ({ value: user.id, label: user.full_name })).sort((a, b) => a.label.localeCompare(b.label)),
])
const typeOptions = computed(() => [{ value: ALL, label: t('hcps.filter.all') }, ...HCP_TYPES.map(type => ({ value: type, label: t(`hcps.types.${type}`) }))])

const person = (user?: Hcp['added_by']) => user?.full_name ?? '—'
const facts = (hcp: Hcp) => [
  { label: t('hcps.read.place'), value: text.place(hcp) },
  { label: t('hcps.fields.phone'), value: hcp.phone || '—' },
  { label: t('hcps.fields.oneKeyId'), value: hcp.one_key_id || '—' },
  { label: t('hcps.fields.gps'), value: hcp.latitude != null && hcp.longitude != null ? `${hcp.latitude}, ${hcp.longitude}` : '—' },
]
const subLine = (hcp: Hcp) => [text.type(hcp.type), text.mainWorkplace(hcp).speciality, text.mainWorkplace(hcp).hco].filter(Boolean).join(' · ')

// Decisions.
const busy = ref<number | null>(null)
const refusing = ref<number | null>(null)
const reason = ref('')
const reasonError = ref('')
async function approve(hcp: Hcp) {
  busy.value = hcp.id
  try {
    await approveHcpRequest(hcp.id)
    toast.success(t('hcps.requests.approved', { name: hcp.name }))
    load()
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    busy.value = null
  }
}
function startRefuse(hcp: Hcp) {
  refusing.value = hcp.id
  reason.value = ''
  reasonError.value = ''
}
async function refuse(hcp: Hcp) {
  if (!reason.value.trim()) {
    reasonError.value = t('users.add.required')
    return
  }
  busy.value = hcp.id
  try {
    await refuseHcpRequest(hcp.id, reason.value.trim())
    toast.success(t('hcps.requests.refused', { name: hcp.name }))
    refusing.value = null
    load()
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    busy.value = null
  }
}
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
      <span>{{ t('hcps.requests.title') }}</span>
    </nav>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[34px]">{{ t('hcps.requests.title') }}</h1>
      <span class="text-xs text-dl-muted">{{ t('hcps.requests.how') }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <div role="radiogroup" :aria-label="t('hcps.requests.state')" class="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:rounded-xl md:bg-dl-line-soft md:p-1">
        <button
          v-for="state in states"
          :key="state.value"
          type="button"
          role="radio"
          :aria-checked="filters.state === state.value"
          class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
          :class="filters.state === state.value ? 'bg-dl-ink text-dl-on-ink dark:bg-dl-fg dark:text-dl-mist' : 'text-dl-body hover:text-dl-fg max-md:bg-dl-paper'"
          @click="filters.state = state.value"
        >
          {{ state.label }}<span v-if="state.count !== undefined" class="tabular-nums opacity-70">{{ n(state.count) }}</span>
        </button>
      </div>
      <DlSelect v-model="filters.addedBy" :label="t('hcps.requests.proposedBy')" :options="userOptions" appearance="filter" />
      <DlSelect v-model="filters.type" :label="t('hcps.fields.type')" :options="typeOptions" appearance="filter" />
    </div>

    <div v-if="loading && !rows.length" class="flex flex-col gap-3" aria-hidden="true">
      <DlSkeleton v-for="i in 3" :key="i" class="h-36 rounded-[20px]" />
    </div>
    <DlEmptyState v-else-if="!rows.length" icon="tabler-inbox" :title="t(`hcps.requests.empty.${filters.state}`)" class="rounded-3xl bg-dl-paper" />

    <section v-for="hcp in rows" :key="hcp.id" class="flex flex-col gap-2.5 rounded-[20px] bg-dl-paper p-4" :aria-label="hcp.name">
      <div class="flex flex-wrap items-start gap-3">
        <DlAvatar :name="avatarName(hcp.name)" size="md" tone="neutral" />
        <div class="flex min-w-0 flex-1 flex-col">
          <strong class="text-[15px]">{{ hcp.name }}</strong>
          <span class="text-[13px] text-dl-muted">{{ subLine(hcp) }}</span>
        </div>
        <span class="text-[12.5px] text-dl-muted">
          {{ t('hcps.requests.by', { name: person(hcp.added_by), date: userText.dateTime(hcp.created_at) }) }}
        </span>
      </div>
      <dl class="grid grid-cols-2 gap-2 text-[13px] md:grid-cols-4">
        <div v-for="fact in facts(hcp)" :key="fact.label" class="min-w-0"><dt class="text-[11.5px] text-dl-muted">{{ fact.label }}</dt><dd class="truncate">{{ fact.value }}</dd></div>
      </dl>

      <div v-for="alike in hcp.lookalikes ?? []" :key="alike.id" class="flex flex-wrap items-center gap-2.5 rounded-2xl bg-dl-pending/10 px-3 py-2.5 text-[13px]">
        <DlIcon icon="tabler-alert-triangle" :size="16" class="text-dl-pending" />
        <span class="min-w-0 flex-1">
          <strong class="text-dl-pending">{{ t('hcps.requests.lookalike', { name: alike.name }) }}</strong>
          ({{ [text.code(alike), text.mainWorkplace(alike).speciality, alike.commune?.name, (alike.match ?? []).map(m => t(`hcps.add.match.${m}`)).join(', ')].filter(Boolean).join(' · ') }}).
          {{ t('hcps.requests.lookalikeHint') }}
        </span>
        <DlButton v-if="canMerge" variant="outline" size="sm" :to="{ name: 'tenant-hcp-merge', params: { keep: alike.id, other: hcp.id } }">
          {{ t('hcps.requests.mergeInto', { code: text.code(alike) }) }}
        </DlButton>
      </div>

      <p v-if="filters.state === 'refused'" class="rounded-xl bg-dl-rejected/10 px-3 py-2 text-[13px]">
        <strong class="text-dl-rejected">{{ t('hcps.requests.refusedBy', { name: person(hcp.decided_by), date: text.date(hcp.decided_at) }) }}</strong> “{{ hcp.refusal_reason }}”
      </p>
      <p v-else-if="filters.state === 'approved'" class="text-[13px] text-dl-muted">{{ t('hcps.requests.approvedBy', { name: person(hcp.decided_by), date: text.date(hcp.decided_at) }) }}</p>

      <form v-if="refusing === hcp.id" class="flex flex-col gap-2 rounded-xl border border-dl-line p-3" @submit.prevent="refuse(hcp)">
        <label class="flex flex-col gap-1.5">
          <span class="text-[13px] font-semibold">{{ t('hcps.requests.reason', { name: person(hcp.added_by) }) }}</span>
          <textarea v-model="reason" rows="2" class="rounded-xl border border-dl-line bg-dl-paper px-3.5 py-2.5 text-sm outline-hidden focus:ring-2 focus:ring-dl-cobalt" />
          <span v-if="reasonError" class="text-xs text-dl-rejected">{{ reasonError }}</span>
        </label>
        <div class="flex justify-end gap-2">
          <DlButton variant="outline" size="sm" @click="refusing = null">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" variant="danger" size="sm" :loading="busy === hcp.id">{{ t('hcps.requests.refuse') }}</DlButton>
        </div>
      </form>
      <div v-else class="flex flex-wrap justify-end gap-2">
        <DlButton variant="ghost" size="sm" icon-end="tabler-arrow-up-right" :to="{ name: 'tenant-hcp-detail', params: { id: hcp.id } }">{{ t('hcps.map.open') }}</DlButton>
        <template v-if="filters.state === 'waiting'">
          <DlButton variant="outline" size="sm" class="text-dl-rejected!" @click="startRefuse(hcp)">{{ t('hcps.requests.refuseEllipsis') }}</DlButton>
          <DlButton variant="primary" size="sm" :loading="busy === hcp.id" @click="approve(hcp)">{{ t('hcps.requests.approve') }}</DlButton>
        </template>
      </div>
    </section>

    <DlPagination v-if="(meta?.total ?? 0) > perPage" v-model="page" v-model:per-page="perPage" :total="meta?.total ?? 0" />
  </div>
</template>

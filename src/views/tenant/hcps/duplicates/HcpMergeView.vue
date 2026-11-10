<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { HCP_MERGE_FIELDS, fetchHcpMergePreview, mergeHcps, type Hcp, type HcpMergeField, type HcpMergePreview } from '@/api/tenant/hcps'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useHcpText } from '../hcpForm'

// Merge two professionals: field by field pick the value to keep (by default the kept record's, its empty
// fields filled from the other), see what moves, confirm. The other record is deleted.
// Mockup: docs/design/customers-mockups/HcpDuplicates.html (frames 3–4)
const props = defineProps<{ keep: string; other: string }>()
const { t, n } = useI18n()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const text = useHcpText()

const preview = ref<HcpMergePreview | null>(null)
const failed = ref(false)
const take = ref<Set<HcpMergeField>>(new Set())

/** What a field shows for a record ('' = empty). */
function shown(hcp: Hcp, field: HcpMergeField): string {
  switch (field) {
    case 'type': return hcp.type ? t(`hcps.types.${hcp.type}`) : ''
    case 'gender': return hcp.gender ? t(`hcps.genders.${hcp.gender}`) : ''
    case 'contacted_by': return hcp.contacted_by ? t(`hcps.contactedBy.${hcp.contacted_by}`) : ''
    case 'status': return hcp.status ? t(`hcps.status.${hcp.status}`) : ''
    case 'verified': return t(hcp.verified ? 'products.yes' : 'products.no')
    case 'commune_id': return hcp.commune ? text.place(hcp) : ''
    case 'gps': return hcp.latitude != null && hcp.longitude != null ? `${hcp.latitude}, ${hcp.longitude}` : ''
    default: return String(hcp[field] ?? '').trim()
  }
}

watch(() => [props.keep, props.other], async () => {
  preview.value = null
  try {
    const data = await fetchHcpMergePreview(Number(props.keep), Number(props.other))
    preview.value = data
    // Default: the kept record's values; its empty fields are filled from the other.
    take.value = new Set(HCP_MERGE_FIELDS.filter(field => !shown(data.keep, field) && shown(data.other, field) && field !== 'verified'))
    failed.value = false
  }
  catch {
    failed.value = true
  }
}, { immediate: true })

const rows = computed(() => {
  const data = preview.value
  if (!data) return []
  return HCP_MERGE_FIELDS.map(field => ({
    field,
    label: t(`hcps.merge.fields.${field}`),
    keep: shown(data.keep, field),
    other: shown(data.other, field),
    same: shown(data.keep, field) === shown(data.other, field),
  }))
})
function pick(field: HcpMergeField, fromOther: boolean) {
  const next = new Set(take.value)
  if (fromOther) next.add(field)
  else next.delete(field)
  take.value = next
}

const moves = computed(() => Object.entries(preview.value?.moves ?? {}).map(([key, value]) => ({ key, value })))
const keptName = computed(() => (preview.value ? (take.value.has('name') ? preview.value.other.name : preview.value.keep.name) : ''))
const header = (hcp: Hcp) => [text.code(hcp), t('hcps.page.added', { date: text.date(hcp.created_at) })].join(' · ')

function swap() {
  router.replace({ name: 'tenant-hcp-merge', params: { keep: props.other, other: props.keep } })
}

const merging = ref(false)
async function merge() {
  const data = preview.value
  if (!data) return
  const ok = await confirm({
    title: t('hcps.merge.confirmTitle', { name: keptName.value }),
    text: t('hcps.merge.confirmText', { other: data.other.name, code: text.code(data.other), keep: keptName.value }),
    confirmButtonText: t('hcps.merge.button'),
    icon: 'warning',
  })
  if (!ok) return
  merging.value = true
  try {
    await mergeHcps(data.keep.id, data.other.id, [...take.value])
    toast.success(t('hcps.merge.done', { name: keptName.value }))
    router.push({ name: 'tenant-hcp-duplicates' })
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    merging.value = false
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5 pb-10">
    <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex flex-wrap items-center gap-1.5 text-sm text-dl-muted">
      <span>{{ t('nav.workspaces.customers') }}</span>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <RouterLink :to="{ name: 'tenant-hcp-duplicates' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('hcps.duplicates.title') }}</RouterLink>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <span>{{ t('hcps.merge.crumb') }}</span>
    </nav>
    <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[34px]">{{ t('hcps.merge.title') }}</h1>

    <p v-if="failed" class="rounded-3xl bg-dl-paper p-5 text-sm text-dl-rejected">{{ t('hcps.merge.notFound') }}</p>
    <DlSkeleton v-else-if="!preview" class="h-96 rounded-3xl" />

    <section v-else class="flex flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-6">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[640px] border-collapse text-[13.5px]">
          <thead>
            <tr class="text-start text-xs font-bold text-dl-muted">
              <th class="w-[150px] px-3 py-2.5 text-start" />
              <th class="rounded-t-xl bg-dl-signal-soft px-3 py-2.5 text-start text-dl-fg">
                ✓ {{ t('hcps.merge.keep') }} · {{ header(preview.keep) }}
                <RouterLink :to="{ name: 'tenant-hcp-detail', params: { id: preview.keep.id } }" target="_blank" class="ms-1 font-semibold text-dl-cobalt">↗</RouterLink>
              </th>
              <th class="px-3 py-2.5 text-start">
                <button type="button" class="inline-flex items-center gap-2 font-semibold text-dl-body hover:text-dl-fg" @click="swap">
                  <span class="h-4 w-4 rounded-full border-[1.5px] border-[#9FB0AA]" aria-hidden="true" />{{ t('hcps.merge.keepInstead') }}
                </button>
                · {{ header(preview.other) }}
                <RouterLink :to="{ name: 'tenant-hcp-detail', params: { id: preview.other.id } }" target="_blank" class="ms-1 font-semibold text-dl-cobalt">↗</RouterLink>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.field" class="border-t border-dl-line-soft">
              <th scope="row" class="px-3 py-2.5 text-start font-normal text-dl-muted">{{ row.label }}</th>
              <template v-if="row.same">
                <td class="px-3 py-2.5 text-dl-muted">{{ row.keep || '—' }}</td>
                <td class="px-3 py-2.5 text-dl-muted">{{ t('hcps.merge.same') }}</td>
              </template>
              <template v-else>
                <td v-for="side in [false, true]" :key="String(side)" class="px-3 py-1.5">
                  <label class="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 hover:bg-dl-mist" :class="take.has(row.field) === side && 'font-semibold'">
                    <input type="radio" :name="row.field" :checked="take.has(row.field) === side" class="h-4 w-4 accent-[#0F1F1C]" @change="pick(row.field, side)">
                    {{ (side ? row.other : row.keep) || '—' }}
                  </label>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-body">{{ t('hcps.merge.defaults') }}</p>

      <h2 class="text-sm font-semibold">{{ t('hcps.merge.moves', { name: keptName }) }}</h2>
      <dl class="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div v-for="move in moves" :key="move.key" class="rounded-2xl bg-dl-mist px-3.5 py-2.5 text-[13px]" :class="!move.value && 'text-dl-muted'">
          <dd class="text-lg font-bold tabular-nums">{{ n(move.value) }}</dd>
          <dt>{{ t(`hcps.merge.what.${move.key}`, move.value) }}</dt>
        </div>
      </dl>
      <p v-for="cycle in preview.shared_cycles" :key="cycle.id" class="text-[12.5px] text-dl-pending">
        ⚠ {{ t('hcps.merge.sharedCycle', { cycle: cycle.user ? `${cycle.name} · ${cycle.user}` : cycle.name }) }}
      </p>
      <p class="text-[12.5px] text-dl-muted">{{ t('hcps.merge.workplacesNote') }}</p>

      <div class="flex flex-wrap justify-between gap-2">
        <DlButton variant="outline" :to="{ name: 'tenant-hcp-duplicates' }">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton variant="primary" :loading="merging" @click="merge">{{ t('hcps.merge.into', { name: keptName }) }}</DlButton>
      </div>
    </section>
  </div>
</template>

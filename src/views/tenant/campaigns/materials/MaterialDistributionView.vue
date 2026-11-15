<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { deleteMaterialDistribution, fetchMaterialDistribution, updateMaterialDistribution, type MaterialDistribution, type StockLine } from '@/api/tenant/materials'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useCampaignText } from '../campaignDisplay'

// A distribution's page: five figures, then each rep's line (given, carried, handed out, left, progress, budget handed
// out). « Donné » changes in place, never below what is handed out. Mockup frame 3.
const props = defineProps<{ id: string; distributionId: string }>()
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useCampaignText()
const canEdit = computed(() => auth.can('campaigns.update'))

const row = ref<MaterialDistribution | null>(null)
const failed = ref(false)
async function load() {
  try {
    row.value = await fetchMaterialDistribution(Number(props.distributionId))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.distributionId, load, { immediate: true })
const back = computed(() => ({ name: 'tenant-campaign', params: { id: props.id }, query: { tab: 'materials' } }))
const money = (value: number | null) => (value == null ? '—' : `${n(value, { maximumFractionDigits: 2 })} DA`)
const tiles = computed(() => {
  const r = row.value
  if (!r) return []
  const all = r.counts.quantity + r.counts.carried
  return [
    { value: n(all), label: r.counts.carried ? t('materials.tiles.givenCarried', { count: n(r.counts.carried) }) : t('materials.tiles.given') },
    { value: n(r.counts.handed_out), label: t('materials.tiles.handedOut', { percent: all ? Math.round((r.counts.handed_out / all) * 100) : 0 }) },
    { value: n(r.counts.left), label: t('materials.tiles.left') },
    { value: money(r.budget.given), label: t('materials.tiles.budgetGiven') },
    { value: money(r.budget.handed_out), label: t('materials.tiles.budgetHandedOut') },
  ]
})

// « Donné » edited in place: one line at a time, saved on Enter or leaving the field.
const editing = ref<number | null>(null)
const draft = ref('')
const lineError = ref<string | null>(null)
function edit(line: StockLine) {
  if (!canEdit.value) return
  editing.value = line.id
  draft.value = String(line.quantity)
  lineError.value = null
}
async function saveLine(line: StockLine) {
  if (editing.value !== line.id || !row.value || !line.user) return
  const quantity = Number(draft.value)
  if (quantity === line.quantity) { editing.value = null; return }
  try {
    row.value = await updateMaterialDistribution(row.value.id, { stocks: [{ user_id: line.user.id, quantity }] })
    editing.value = null
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    lineError.value = Object.values(fieldErrors(error))[0] ?? errorMessage(error) ?? t('studio.list.toast.failed')
  }
}
async function remove() {
  if (!row.value) return
  const ok = await confirm({ title: t('materials.page.deleteTitle', { name: row.value.materiel.name }), text: t('materials.page.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteMaterialDistribution(row.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push(back.value)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const share = (line: StockLine) => {
  const all = line.quantity + line.carried
  return all ? (line.handed_out / all) * 100 : 0
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('materials.page.notFound')">
      <DlButton variant="outline" :to="back">{{ t('campaignMessages.page.back') }}</DlButton>
    </DlEmptyState>
    <DlSkeleton v-else-if="!row" class="h-96 rounded-3xl" />
    <template v-else>
      <div class="flex flex-col gap-2">
        <nav class="flex flex-wrap items-center gap-1.5 text-[13px] text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
          <RouterLink :to="{ name: 'tenant-campaigns' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('campaigns.list.title') }}</RouterLink>
          <DlIcon icon="tabler-chevron-right" :size="14" />
          <RouterLink :to="back" class="text-dl-muted no-underline hover:text-dl-fg">{{ row.campaign.name }} · {{ t('campaigns.tabs.materials') }}</RouterLink>
        </nav>
        <div class="flex flex-wrap items-center gap-2.5">
          <h1 class="font-display text-[24px] font-extrabold leading-tight tracking-[-0.02em] md:text-[28px]">{{ row.materiel.name }}</h1>
          <DlBadge>{{ row.materiel.role ? roleLabel(row.materiel.role.name) : t('fieldSetup.allFieldRoles') }}</DlBadge>
          <DlBadge :tone="row.type === 'visit' ? 'success' : 'info'">{{ t(`materials.type.${row.type}`) }}</DlBadge>
          <DlBadge>{{ row.month ? text.date(row.month) : text.period(row.campaign.start_date, row.campaign.end_date) }}</DlBadge>
          <DlButton v-if="canEdit" variant="ghost" icon="tabler-trash" class="ms-auto" @click="remove">{{ t('common.actions.delete') }}</DlButton>
        </div>
        <span class="text-[13px] text-dl-muted">
          {{ [t('materials.page.brand', { name: row.brand.name }), row.specialities.map(s => s.name).join(', '), row.unit_cost != null ? t('materials.page.cost', { cost: money(row.unit_cost) }) : null,
              t(`materials.leftover.${row.leftover}`), row.created_by ? t('materials.page.by', { name: row.created_by.full_name, date: text.date(row.created_at) }) : null].filter(Boolean).join(' · ') }}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div v-for="tile in tiles" :key="tile.label" class="flex flex-col gap-1 rounded-3xl bg-dl-paper p-4">
          <strong class="font-display text-[24px] leading-none">{{ tile.value }}</strong>
          <span class="text-xs text-dl-muted">{{ tile.label }}</span>
        </div>
      </div>
      <div class="overflow-x-auto rounded-3xl bg-dl-paper p-4 md:p-5">
        <table class="w-full text-[13.5px]">
          <thead><tr class="border-b border-dl-line text-xs text-dl-muted">
            <th class="py-2 text-start font-semibold">{{ t('materials.columns.person') }}</th>
            <th class="py-2 text-start font-semibold">{{ t('materials.columns.team') }}</th>
            <th class="py-2 text-end font-semibold">{{ t('materials.columns.given') }}</th>
            <th class="py-2 text-end font-semibold">{{ t('materials.columns.carried') }}</th>
            <th class="py-2 text-end font-semibold">{{ t('materials.columns.handedOut') }}</th>
            <th class="py-2 text-end font-semibold">{{ t('materials.columns.left') }}</th>
            <th class="py-2 ps-4 text-start font-semibold">{{ t('materials.columns.progress') }}</th>
            <th class="py-2 text-end font-semibold">{{ t('materials.columns.budgetHandedOut') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="line in row.stocks" :key="line.id" class="border-b border-dl-line-soft">
              <td class="py-2.5 font-semibold">{{ line.user?.full_name ?? '—' }}<span v-if="editing === line.id && lineError" class="block text-xs font-normal text-dl-rejected">{{ lineError }}</span></td>
              <td class="py-2.5 text-dl-muted">{{ line.team ?? '—' }}</td>
              <td class="py-2.5 text-end">
                <input v-if="editing === line.id" v-model="draft" type="number" min="0" class="h-8 w-20 rounded-[10px] border border-dl-cobalt bg-dl-paper px-2 text-end font-semibold" :aria-label="t('materials.columns.given')"
                  @keydown.enter.prevent="saveLine(line)" @blur="saveLine(line)">
                <button v-else type="button" class="rounded-lg px-2 py-1 font-semibold tabular-nums" :class="canEdit && 'hover:bg-dl-line-soft'" :disabled="!canEdit" @click="edit(line)">{{ n(line.quantity) }}</button>
              </td>
              <td class="py-2.5 text-end"><span v-if="line.carried" class="rounded-full bg-dl-cobalt/10 px-2 py-0.5 text-xs font-bold text-dl-cobalt">+{{ n(line.carried) }}</span><span v-else class="text-dl-muted">—</span></td>
              <td class="py-2.5 text-end tabular-nums">{{ n(line.handed_out) }}</td>
              <td class="py-2.5 text-end font-bold tabular-nums">{{ n(line.left) }}<span v-if="line.carried_out" class="block text-[11px] font-normal text-dl-muted">{{ t('materials.page.carriedOut', { count: n(line.carried_out) }) }}</span></td>
              <td class="py-2.5 ps-4"><span class="flex h-2 w-28 overflow-hidden rounded-full bg-dl-line-soft"><span class="h-full bg-dl-teal" :style="{ width: `${share(line)}%` }" /></span></td>
              <td class="py-2.5 text-end tabular-nums">{{ money(line.budget_handed_out) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="mt-3 text-xs text-dl-muted">{{ t('materials.page.note') }}</p>
      </div>
    </template>
  </div>
</template>

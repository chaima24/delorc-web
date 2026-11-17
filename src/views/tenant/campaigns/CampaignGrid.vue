<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { checkAllForTeam, fetchCampaignGrid, type Campaign, type CampaignGrid, type CampaignTick } from '@/api/tenant/campaigns'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import CampaignCopySheet from './CampaignCopySheet.vue'
import CampaignTickSheet, { type TickCell } from './CampaignTickSheet.vue'
import { brandInitials } from './campaignDisplay'

// The "Grille promo" tab: one column per team, one row per brand, in each cell the team's specialities as pills
// coloured by their priority (✉ when there is a message, shown on hover). A dashed "+" pill ticks a speciality; a
// click on a tick opens its window. Every team stays on one page: the grid scrolls sideways with the brands fixed.
// Mockup: docs/design/campaigns-mockups/Campaigns.html (frames 4 to 6, 4a)
const props = defineProps<{ campaign: Campaign; canEdit: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { t, n } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

const grid = ref<CampaignGrid | null>(null)
async function load() {
  try {
    grid.value = await fetchCampaignGrid(props.campaign.id)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
watch(() => props.campaign.id, load, { immediate: true })
const changed = (value?: CampaignGrid) => {
  if (value) grid.value = value
  else load()
  emit('changed')
}

// Filters, all done here on the one answer: a team, a brand name, ticked pills only.
const ALL = 'all'
const teamFilter = ref(ALL)
const search = ref('')
const onlyTicked = ref(false)
const teamItems = computed(() => [{ value: ALL, label: t('campaigns.grid.allTeams') }, ...(grid.value?.teams ?? []).map(team => ({ value: String(team.id), label: team.name }))])
const teams = computed(() => (grid.value?.teams ?? []).filter(team => teamFilter.value === ALL || String(team.id) === teamFilter.value))

const tickAt = computed(() => new Map((grid.value?.ticks ?? []).map(tick => [`${tick.team_id}-${tick.brand_id}-${tick.speciality_id}`, tick])))
const find = (teamId: number, brandId: number, specialityId: number) => tickAt.value.get(`${teamId}-${brandId}-${specialityId}`)
const allowed = (team: CampaignGrid['teams'][number], brandId: number) => team.brand_ids === null || team.brand_ids.includes(brandId)
const brands = computed(() => {
  const words = search.value.trim().toLowerCase()
  return (grid.value?.brands ?? []).filter(brand => (!words || brand.name.toLowerCase().includes(words))
    && (!onlyTicked.value || teams.value.some(team => team.specialities.some(speciality => find(team.id, brand.id, speciality.id)))))
})
/** What the table draws: per brand, per team, the speciality pills with their tick (or none). */
const rows = computed(() => brands.value.map(brand => ({
  brand,
  cells: teams.value.map(team => ({
    team,
    allowed: allowed(team, brand.id),
    pills: team.specialities.map(speciality => ({ speciality, tick: find(team.id, brand.id, speciality.id) })),
  })),
})))
const brandTicks = (brandId: number) => (grid.value?.ticks ?? []).filter(tick => tick.brand_id === brandId).length
const withMessage = computed(() => (grid.value?.ticks ?? []).filter(tick => tick.message).length)

// The tick window.
const cell = ref<TickCell | null>(null)
function open(team: CampaignGrid['teams'][number], brand: { id: number; name: string }, speciality: { id: number; name: string }, tick?: CampaignTick) {
  if (!props.canEdit) return
  cell.value = { campaignId: props.campaign.id, team, brand, speciality, tick: tick ?? null }
}
const tickOpen = computed({ get: () => cell.value !== null, set: value => { if (!value) cell.value = null } })

async function checkAll(team: CampaignGrid['teams'][number]) {
  const ok = await confirm({ title: t('campaigns.grid.checkAllTitle', { team: team.name }), text: t('campaigns.grid.checkAllText'), confirmButtonText: t('campaigns.grid.checkAll'), icon: 'question' })
  if (!ok) return
  try {
    changed(await checkAllForTeam(props.campaign.id, team.id))
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

const copying = ref(false)
const pillStyle = (tick: CampaignTick) => {
  const color = tick.priority?.color ?? 'var(--color-dl-ink)'
  return { background: `color-mix(in srgb, ${color} 14%, transparent)` }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2.5">
      <DlSegmented v-model="teamFilter" :label="t('campaigns.fields.teams')" :items="teamItems" />
      <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('campaigns.grid.search')" :placeholder="t('campaigns.grid.search')" icon="tabler-search" hide-label /></div>
      <DlSwitch v-model="onlyTicked" :label="t('campaigns.grid.onlyTicked')" />
      <span class="ms-auto text-xs text-dl-muted">{{ t('campaigns.grid.counts', { ticks: n(grid?.ticks.length ?? 0), messages: n(withMessage) }) }}</span>
      <DlButton v-if="canEdit" size="sm" variant="outline" icon="tabler-copy" @click="copying = true">{{ t('campaigns.copy.button') }}</DlButton>
    </div>
    <div class="flex flex-wrap items-center gap-2 text-xs text-dl-muted">
      <span v-for="priority in [...new Map((grid?.ticks ?? []).filter(tick => tick.priority).map(tick => [tick.priority!.id, tick.priority!])).values()].sort((a, b) => a.order - b.order)" :key="priority.id" class="inline-flex items-center gap-1.5 rounded-full border border-dl-line bg-dl-paper px-2.5 py-1 font-semibold text-dl-body">
        <i class="h-2.5 w-2.5 rounded-full" :style="{ background: priority.color }" />{{ priority.name }}
      </span>
      <span class="inline-flex items-center gap-1.5 rounded-full border border-dl-line bg-dl-paper px-2.5 py-1 font-semibold text-dl-body"><i class="h-2.5 w-2.5 rounded-full bg-dl-ink" />{{ t('campaigns.tick.noPriority') }}</span>
      <span v-if="canEdit" class="ms-2">{{ t('campaigns.grid.hint') }}</span>
    </div>

    <DlSkeleton v-if="!grid" class="h-72 rounded-3xl" />
    <p v-else-if="!rows.length" class="rounded-3xl bg-dl-paper p-6 text-center text-[13px] text-dl-muted">{{ t(onlyTicked || search ? 'campaigns.grid.noneFound' : 'campaigns.grid.noBrand') }}</p>
    <div v-else class="overflow-x-auto pb-2">
      <table class="w-max min-w-full border-separate border-spacing-y-2.5 text-[13px]">
        <thead>
          <tr>
            <th class="sticky start-0 z-10 bg-dl-mist" />
            <th v-for="team in teams" :key="team.id" class="min-w-[340px] px-1.5 text-start align-bottom font-normal">
              <div class="flex items-center gap-2.5 rounded-2xl bg-dl-paper px-3.5 py-3">
                <div class="min-w-0 flex-1">
                  <strong class="block text-[15px]">{{ team.name }}</strong>
                  <span class="text-xs text-dl-muted">{{ t('campaigns.grid.teamCounts', { specialities: team.specialities.length, ticks: team.ticks_count }) }}</span>
                </div>
                <button v-if="canEdit" type="button" class="cursor-pointer text-xs font-semibold text-dl-cobalt hover:underline" @click="checkAll(team)">{{ t('campaigns.grid.checkAll') }}</button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.brand.id">
            <th scope="row" class="sticky start-0 z-10 w-[200px] rounded-s-2xl bg-dl-paper px-3.5 py-3 text-start align-top font-normal shadow-[8px_0_12px_-10px_rgba(15,31,28,0.25)]">
              <div class="flex items-center gap-2.5">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dl-mist font-display text-[13px] font-extrabold">{{ brandInitials(row.brand.name) }}</span>
                <div class="min-w-0"><strong class="block truncate text-[15px]">{{ row.brand.name }}</strong><span class="text-xs text-dl-muted">{{ t('campaigns.promoted.ticks', brandTicks(row.brand.id)) }}</span></div>
              </div>
            </th>
            <td v-for="(cellRow, i) in row.cells" :key="cellRow.team.id" class="border-s border-dl-line-soft bg-dl-paper px-3.5 py-3 align-top" :class="i === row.cells.length - 1 && 'rounded-e-2xl'">
              <div v-if="!cellRow.allowed" class="rounded-xl bg-[repeating-linear-gradient(135deg,transparent_0_8px,var(--color-dl-line-soft)_8px_9px)] px-3 py-2.5 text-xs text-dl-muted">{{ t('campaigns.grid.notTeamBrand', { team: cellRow.team.name }) }}</div>
              <div v-else class="flex flex-wrap gap-1.5">
                <template v-for="pill in cellRow.pills" :key="pill.speciality.id">
                  <span v-if="pill.tick" class="group relative">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 rounded-full py-1 ps-1 pe-3 font-semibold text-dl-fg"
                      :class="canEdit ? 'cursor-pointer hover:ring-2 hover:ring-dl-cobalt' : 'cursor-default'"
                      :style="pillStyle(pill.tick)"
                      :aria-label="t('campaigns.grid.tickLabel', { brand: row.brand.name, speciality: pill.speciality.name, priority: pill.tick.priority?.name ?? t('campaigns.tick.noPriority') })"
                      @click="open(cellRow.team, row.brand, pill.speciality, pill.tick)"
                    >
                      <span class="inline-flex h-[22px] min-w-[26px] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold text-white" :style="{ background: pill.tick.priority?.color ?? 'var(--color-dl-ink)' }">{{ pill.tick.priority?.name ?? '—' }}</span>
                      {{ pill.speciality.name }}
                      <span v-if="pill.tick.message" class="text-xs opacity-70" aria-hidden="true">✉</span>
                    </button>
                    <span v-if="pill.tick.message" role="tooltip" class="pointer-events-none absolute start-0 top-[calc(100%+8px)] z-20 hidden w-72 rounded-xl bg-dl-ink p-3 text-xs leading-relaxed text-dl-on-ink shadow-lg group-hover:block">
                      <small class="mb-0.5 block font-bold text-dl-signal">{{ pill.tick.priority?.name ?? t('campaigns.tick.noPriority') }} · {{ row.brand.name }} → {{ pill.speciality.name }}</small>
                      « {{ pill.tick.message }} »
                    </span>
                  </span>
                  <button
                    v-else-if="!onlyTicked && canEdit"
                    type="button"
                    class="cursor-pointer rounded-full border-[1.5px] border-dashed border-dl-line px-3 py-[3px] text-dl-muted hover:border-dl-cobalt hover:text-dl-cobalt"
                    @click="open(cellRow.team, row.brand, pill.speciality)"
                  >+ {{ pill.speciality.name }}</button>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <CampaignTickSheet v-if="cell" v-model:open="tickOpen" :cell="cell" :settings="grid!.settings" @saved="changed()" />
    <CampaignCopySheet v-if="copying" v-model:open="copying" :campaign="campaign" @copied="value => changed(value)" />
  </div>
</template>

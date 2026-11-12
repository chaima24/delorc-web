<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchRuleType, fetchRuleTypes, type RuleType } from '@/api/tenant/ruleTypes'
import DlBadge from '@/components/DlBadge.vue'
import DlDataList from '@/components/DlDataList.vue'
import { useToast } from '@/composables/useToast'
import RuleTypePanel from './RuleTypePanel.vue'
import { chainOf as chainIn, groupRuleTypes } from './ruleTypeOrder'

// Studio › Géographie › Types de règles: what a territory can be built from. Read only: central sets the
// types up (docs/api/rule-types.md). A strip shows how they nest, the table their choices, extras and use.
const { t, n } = useI18n()
const toast = useToast()

const types = ref<RuleType[]>([])
const loading = ref(true)
async function load() {
  loading.value = true
  try {
    types.value = await fetchRuleTypes()
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
load()

const groups = computed(() => groupRuleTypes(types.value))
// The API answers in chain order already.
const rows = types
const chainOf = (type: RuleType) => chainIn(groups.value, type)

function place(type: RuleType) {
  if (!type.hcp_path) return t('ruleTypes.link.none')
  const chain = chainOf(type)
  const parent = chain[chain.indexOf(type) - 1]
  if (parent) return t('ruleTypes.inside', { name: parent.name })
  return chain.length > 1 ? t('ruleTypes.top') : t('ruleTypes.alone')
}
function extras(type: RuleType) {
  const list: string[] = []
  if (type.supports_sub_zone) list.push(`${t('ruleTypes.subZones')} · ${n(type.sub_zones_count ?? 0)}`)
  if (type.supports_zone_type) list.push(t('ruleTypes.zoneType'))
  return list
}

const open = ref(false)
const selected = ref<RuleType | null>(null)
async function show(id: number) {
  try {
    selected.value = await fetchRuleType(id)
    open.value = true
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}

const columns = [
  { key: 'name', label: t('ruleTypes.columns.type') },
  { key: 'choices', label: t('ruleTypes.figures.choices'), align: 'end' as const },
  { key: 'extras', label: t('ruleTypes.columns.extras'), secondary: true },
  { key: 'territories', label: t('ruleTypes.columns.territories'), align: 'end' as const },
  { key: 'visible', label: t('ruleTypes.columns.visible') },
]
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-sm text-dl-muted">{{ t('nav.workspaces.studio') }}</span>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('ruleTypes.title') }}</h1>
      <p class="text-sm text-dl-muted">{{ t('ruleTypes.subtitle') }}</p>
    </div>

    <div v-if="rows.length" class="flex flex-wrap items-start gap-x-7 gap-y-4 rounded-3xl bg-dl-paper p-4 md:p-5">
      <div v-if="groups.chains.length" class="flex flex-col gap-2">
        <span class="text-xs font-semibold text-dl-muted">{{ t('ruleTypes.strip.chains') }}</span>
        <div v-for="chain in groups.chains" :key="chain[0]!.code" class="flex flex-wrap items-center gap-2">
          <template v-for="(type, index) in chain" :key="type.code">
            <span v-if="index" class="text-dl-muted rtl:-scale-x-100" aria-hidden="true">›</span>
            <button
              type="button"
              class="inline-flex h-9 items-center gap-2 rounded-[11px] border px-3 text-[13.5px] font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
              :class="[open && selected?.code === type.code ? 'border-dl-ink bg-dl-ink text-dl-on-ink dark:border-dl-fg dark:bg-dl-fg dark:text-dl-mist' : 'border-dl-line hover:border-dl-body', !type.is_visible && 'border-dashed text-dl-muted']"
              @click="show(type.id)"
            >
              {{ type.name }}<span class="text-xs font-medium tabular-nums opacity-70">{{ type.is_visible ? n(type.choices_count ?? 0) : t('ruleTypes.hidden') }}</span>
            </button>
          </template>
        </div>
      </div>
      <span v-if="groups.chains.length && groups.alone.length" class="hidden w-px self-stretch bg-dl-line md:block" aria-hidden="true" />
      <div v-if="groups.alone.length" class="flex flex-col gap-2">
        <span class="text-xs font-semibold text-dl-muted">{{ t('ruleTypes.strip.alone') }}</span>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="type in groups.alone"
            :key="type.code"
            type="button"
            class="inline-flex h-9 items-center gap-2 rounded-[11px] border px-3 text-[13.5px] font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
            :class="[open && selected?.code === type.code ? 'border-dl-ink bg-dl-ink text-dl-on-ink dark:border-dl-fg dark:bg-dl-fg dark:text-dl-mist' : 'border-dl-line hover:border-dl-body', !type.is_visible && 'border-dashed text-dl-muted']"
            @click="show(type.id)"
          >
            {{ type.name }}<span class="text-xs font-medium tabular-nums opacity-70">{{ type.is_visible ? n(type.choices_count ?? 0) : t('ruleTypes.hidden') }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-start gap-5">
      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          :label="t('ruleTypes.title')"
          :columns="columns"
          :rows="rows"
          :row-key="row => row.id"
          :selected-key="open ? selected?.id : null"
          :loading="loading"
          :compact="open"
          :empty-title="t('ruleTypes.empty')"
          @open="row => show(row.id)"
        >
          <template #cell-name="{ row }">
            <span class="flex min-w-0 flex-col">
              <strong class="font-semibold">{{ row.name }}</strong>
              <span class="truncate text-xs" :class="row.hcp_path ? 'text-dl-muted' : 'text-dl-pending'">{{ place(row) }}</span>
            </span>
          </template>
          <template #cell-choices="{ row }"><span class="tabular-nums">{{ n(row.choices_count ?? 0) }}</span></template>
          <template #cell-extras="{ row }">
            <span v-if="extras(row).length" class="flex flex-wrap gap-1.5"><DlBadge v-for="extra in extras(row)" :key="extra" size="sm">{{ extra }}</DlBadge></span>
            <span v-else class="text-dl-muted">—</span>
          </template>
          <template #cell-territories="{ row }"><span class="tabular-nums">{{ row.territories_count ? n(row.territories_count) : '—' }}</span></template>
          <template #cell-visible="{ row }">
            <span class="inline-flex items-center gap-1.5 text-[13px] font-semibold" :class="row.is_visible && row.hcp_path ? 'text-dl-teal' : 'text-dl-muted'">
              <span class="h-2 w-2 rounded-full bg-current" />{{ row.is_visible && row.hcp_path ? t('ruleTypes.shown') : t('ruleTypes.hidden') }}
            </span>
          </template>
          <template #card="{ row }">
            <span class="flex items-center gap-3">
              <span class="flex min-w-0 flex-1 flex-col">
                <strong class="truncate font-semibold">{{ row.name }}</strong>
                <span class="truncate text-xs text-dl-muted">
                  {{ t('ruleTypes.card.choices', { n: n(row.choices_count ?? 0) }, row.choices_count ?? 0) }} ·
                  {{ row.territories_count ? t('ruleTypes.card.territories', { n: n(row.territories_count) }, row.territories_count) : t('ruleTypes.card.noTerritory') }}
                </span>
              </span>
              <span class="h-2 w-2 shrink-0 rounded-full" :class="row.is_visible ? 'bg-dl-teal' : 'bg-dl-muted'" :aria-label="row.is_visible ? t('ruleTypes.shown') : t('ruleTypes.hidden')" />
            </span>
          </template>
        </DlDataList>
      </div>

      <RuleTypePanel v-if="selected" v-model:open="open" :rule-type="selected" :chain="chainOf(selected)" />
    </div>
  </div>
</template>

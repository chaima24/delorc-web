<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchRuleTypeOptions, type RuleType, type RuleTypeOption } from '@/api/tenant/ruleTypes'
import { ZONE_TYPES, type ZoneType } from '@/api/tenant/territories'
import DlCombobox from '@/components/DlCombobox.vue'
import DlIcon from '@/components/DlIcon.vue'
import { addPick, removePick, scopeOf, zoneItems, type CoverPick, type Zones } from './coversForm'
import { ZONE_TONES, useTerritoryText } from './territoryText'

// What a territory covers: pick items of any rule type linked to professionals (the most precise
// pick wins: a commune replaces its wilaya) and a residence level per wilaya. The live count is
// beside it (useCoverage · CoverageCount). Rule: docs/DECISIONS.md. Mockup: docs/design/customers-mockups/Territories.html (frame 4)
const props = defineProps<{ types: RuleType[]; error?: string }>()
const picks = defineModel<CoverPick[]>('picks', { required: true })
const zones = defineModel<Zones>('zones', { required: true })
const { t, n } = useI18n()
const text = useTerritoryText()

const current = ref<string>(props.types[0]?.code ?? '')
watch(() => props.types, types => {
  if (!types.some(type => type.code === current.value)) current.value = types[0]?.code ?? ''
})
const currentType = computed(() => props.types.find(type => type.code === current.value))
const countOf = (code: string) => picks.value.filter(pick => pick.type === code).length

// Items of each type, by code. The chosen type's whole chain is loaded: once a parent item is in
// play its choices are narrowed to it (a commune to the picked wilayas); with none, all are offered.
const optionsByCode = ref<Record<string, RuleTypeOption[]>>({})
const loadingOptions = ref(false)
function chainOf(type: RuleType): RuleType[] {
  const chain = [type]
  const add = (item?: RuleType) => item && !chain.includes(item) && chain.push(item)
  for (let i = 0; i < chain.length; i++) {
    add(props.types.find(item => item.code === chain[i]!.parent_code))
    props.types.filter(item => item.parent_code === chain[i]!.code).forEach(add)
  }
  return chain
}
watch(currentType, async type => {
  if (!type) return
  const missing = chainOf(type).filter(item => !optionsByCode.value[item.code])
  if (!missing.length) return
  loadingOptions.value = true
  try {
    const loaded = await Promise.all(missing.map(async item => [item.code, await fetchRuleTypeOptions(item.id)] as const))
    optionsByCode.value = { ...optionsByCode.value, ...Object.fromEntries(loaded) }
  }
  finally {
    loadingOptions.value = false
  }
}, { immediate: true })
const options = computed(() => optionsByCode.value[current.value] ?? [])
const parentOf = (code: string, id: number) => optionsByCode.value[code]?.find(option => !option.is_sub_zone && option.id === id)?.parent_id

const scope = computed(() => scopeOf(props.types, picks.value, current.value, parentOf))
const scopeNames = computed(() => {
  if (!scope.value) return ''
  const names = new Map((optionsByCode.value[scope.value.parent.code] ?? []).filter(option => !option.is_sub_zone).map(option => [option.id, option.label]))
  for (const pick of picks.value) if (pick.parentId != null && pick.parentName) names.set(pick.parentId, names.get(pick.parentId) ?? pick.parentName)
  return [...scope.value.ids].map(id => names.get(id) ?? `#${id}`).sort((a, b) => a.localeCompare(b)).join(', ')
})
const scoped = computed(() => {
  const limit = scope.value
  if (!limit?.ids.size) return options.value
  const mains = new Set(options.value.filter(option => !option.is_sub_zone && option.parent_id != null && limit.ids.has(option.parent_id)).map(option => option.id))
  return options.value.filter(option => (option.is_sub_zone ? option.parent_id != null && mains.has(option.parent_id) : mains.has(option.id)))
})

const pickedKeys = computed(() => new Set(picks.value.map(pick => `${pick.type}:${pick.isSub ? 'sub' : 'main'}:${pick.id}`)))
const comboOptions = computed(() => scoped.value
  .filter(option => !pickedKeys.value.has(`${current.value}:${option.value}`))
  .map(option => ({
    value: option.value,
    label: option.label,
    hint: option.is_sub_zone
      ? t('territories.covers.subZoneOf', { name: option.parent_label ?? '' })
      : option.parent_label ?? undefined,
  })))

const notice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
const chosen = ref<string | number | null>(null)
watch(chosen, value => {
  if (value == null) return
  const option = options.value.find(item => item.value === value)
  chosen.value = null
  if (!option || !currentType.value) return
  const result = addPick(props.types, picks.value, {
    type: current.value,
    id: option.id,
    isSub: option.is_sub_zone,
    name: option.label,
    parentId: option.parent_id,
    parentName: option.parent_label,
  })
  picks.value = result.picks
  clearTimeout(noticeTimer)
  notice.value = result.replaced.length ? t('territories.covers.replaced', { names: result.replaced.map(pick => pick.name).join(', '), name: option.label }) : ''
  if (notice.value) noticeTimer = setTimeout(() => (notice.value = ''), 6000)
})

const groups = computed(() => props.types
  .map(type => ({ type, picks: picks.value.filter(pick => pick.type === type.code).sort((a, b) => a.name.localeCompare(b.name)) }))
  .filter(group => group.picks.length))
function hint(pick: CoverPick) {
  if (pick.isSub) return t('territories.covers.subZoneOf', { name: pick.parentName ?? '' })
  return pick.parentName ?? ''
}

const residence = computed(() => zoneItems(props.types, picks.value))
function setZone(id: number, type: ZoneType) {
  zones.value = { ...zones.value, [id]: zones.value[id] === type ? undefined : type }
}

</script>

<template>
  <div class="flex flex-col gap-3.5">
    <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-[13px] text-dl-body">{{ t('territories.covers.how') }}</p>

    <div role="tablist" :aria-label="t('territories.covers.typeLabel')" class="flex flex-wrap gap-1.5">
      <button
        v-for="type in types"
        :key="type.code"
        type="button"
        role="tab"
        :aria-selected="current === type.code"
        class="inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
        :class="current === type.code ? 'border-dl-ink bg-dl-ink text-dl-on-ink dark:border-dl-fg dark:bg-dl-fg dark:text-dl-mist' : 'border-dl-line text-dl-body hover:border-dl-body'"
        @click="current = type.code"
      >
        {{ type.name }}<span v-if="countOf(type.code)" class="text-[11.5px] tabular-nums opacity-70">{{ n(countOf(type.code)) }}</span>
      </button>
    </div>

    <DlCombobox
      v-if="currentType"
      v-model="chosen"
      :label="t('territories.covers.add', { type: currentType.name })"
      :placeholder="loadingOptions ? t('territories.loading') : t('territories.covers.add', { type: currentType.name })"
      :options="comboOptions"
      :disabled="loadingOptions"
      hide-label
    />
    <p v-if="currentType && scope?.ids.size" class="-mt-1.5 text-[12.5px] text-dl-muted">{{ t('territories.covers.limitedTo', { type: currentType.name, parent: scope.parent.name, names: scopeNames }) }}</p>
    <p v-if="notice" class="text-[12.5px] text-dl-muted" role="status">{{ notice }}</p>

    <div v-if="groups.length" class="flex flex-col gap-2.5">
      <section v-for="group in groups" :key="group.type.code" class="rounded-2xl border border-dl-line">
        <h4 class="px-3.5 pb-1 pt-2.5 text-xs font-semibold text-dl-muted">{{ group.type.name }}</h4>
        <ul>
          <li v-for="pick in group.picks" :key="`${pick.isSub}-${pick.id}`" class="flex items-center gap-2 border-t border-dl-line-soft px-3.5 py-2 text-[13px] first:border-0">
            <span class="flex min-w-0 flex-1 flex-col">
              <strong class="truncate font-semibold">{{ pick.name }}</strong>
              <span v-if="hint(pick)" class="truncate text-xs text-dl-muted">{{ hint(pick) }}</span>
            </span>
            <button type="button" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-dl-muted hover:bg-dl-mist hover:text-dl-fg" :aria-label="t('territories.covers.remove', { name: pick.name })" @click="picks = removePick(picks, pick)">
              <DlIcon icon="tabler-x" :size="16" />
            </button>
          </li>
        </ul>
      </section>
    </div>
    <p v-else class="text-[13px]" :class="error ? 'text-dl-rejected' : 'text-dl-muted'">{{ error || t('territories.covers.empty') }}</p>

    <section v-if="residence.length" class="rounded-2xl border border-dl-line px-3.5 py-2.5">
      <h4 class="text-sm font-semibold">{{ t('territories.covers.residence') }}</h4>
      <p class="mb-1.5 text-xs text-dl-muted">{{ t('territories.covers.residenceHint') }}</p>
      <ul>
        <li v-for="item in residence" :key="item.id" class="flex flex-wrap items-center gap-2 border-t border-dl-line-soft py-2 text-[13px] first:border-0">
          <span class="min-w-0 flex-1 truncate font-semibold">{{ item.name }}</span>
          <span class="inline-flex gap-0.5 rounded-[9px] bg-dl-mist p-0.5" role="group" :aria-label="t('territories.covers.residenceOf', { name: item.name })">
            <button
              v-for="type in ZONE_TYPES"
              :key="type"
              type="button"
              :aria-pressed="zones[item.id] === type"
              class="h-7 rounded-[7px] px-2 text-[11.5px] font-semibold transition"
              :class="zones[item.id] === type ? ZONE_TONES[type] : 'text-dl-body hover:text-dl-fg'"
              @click="setZone(item.id, type)"
            >
              {{ text.zone(type) }}
            </button>
          </span>
        </li>
      </ul>
    </section>

  </div>
</template>

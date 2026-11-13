<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RuleType } from '@/api/tenant/ruleTypes'
import DlBadge from '@/components/DlBadge.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { customersSection, geographySection, type StudioSection } from '@/views/tenant/settings/shared/studioSections'

// A rule type in the side panel, read only (set up from the central console): what picking it does,
// where it sits, its extras, how it reaches professionals and people, where its choices are managed
// and the territories using it.
// docs/api/rule-types.md. Territories using it come with the territories module.
const props = defineProps<{ ruleType: RuleType; chain: RuleType[] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n, te } = useI18n()
const auth = useAuthStore()
const canShow = (resource: string) => auth.can(`${resource}.show`)

const parent = computed(() => props.chain[props.chain.findIndex(item => item.code === props.ruleType.code) - 1] ?? null)
const tiles = computed(() => [
  { label: t('ruleTypes.figures.choices'), value: n(props.ruleType.choices_count ?? 0) },
  { label: t('ruleTypes.figures.territories'), value: n(props.ruleType.territories_count ?? 0) },
])

// The Studio page that manages a table's items, found by the table name (= the page's count key).
function studioPage(table: string | null) {
  for (const section of [geographySection, customersSection] as StudioSection[]) {
    const level = section.levels.find(item => item.count === table)
    if (level) return { section, level }
  }
  return null
}
const sources = computed(() => [props.ruleType.main_table, props.ruleType.supports_sub_zone ? props.ruleType.sub_zone_table : null]
  .map(studioPage)
  .filter((page): page is NonNullable<typeof page> => !!page))

// "Professional › commune › wilaya" from `commune.wilaya_id`, "Person › home commune › wilaya" for
// the user link (docs/DECISIONS.md). A bare `id` at the end adds nothing and is dropped.
const step = (word: string, side: 'link' | 'userLink') => {
  const key = [`ruleTypes.${side}.steps.${word}`, `ruleTypes.link.steps.${word}`].find(key => te(key))
  return key ? t(key) : word.replace(/_id$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()
}
const linkSteps = (path?: string | null, side: 'link' | 'userLink' = 'link') => (path
  ? [t(side === 'link' ? 'ruleTypes.link.steps.professional' : 'ruleTypes.userLink.steps.person'), ...path.split('.').filter(word => word !== 'id').map(word => step(word, side))].join(' › ')
  : '')
const appliesTo = computed(() => props.ruleType.hcp_types?.length
  ? props.ruleType.hcp_types.map(type => t(`hcps.typesPlural.${type}`)).join(', ')
  : t('ruleTypes.link.everyone'))

const territories = computed(() => props.ruleType.territories ?? [])
function picked(territory: { choices: number; sub_zones: number }) {
  const parts = [t('ruleTypes.read.picked', { n: n(territory.choices) }, territory.choices)]
  if (territory.sub_zones) parts.push(t('ruleTypes.read.pickedSubZones', { n: n(territory.sub_zones) }, territory.sub_zones))
  return parts.join(' · ')
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="ruleType.name">
    <template #media>
      <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-dl-signal text-dl-ink"><DlIcon icon="tabler-list-details" :size="26" /></span>
    </template>
    <template #badges>
      <span class="mt-1 flex flex-wrap items-center gap-1.5">
        <DlBadge size="sm">{{ parent ? t('ruleTypes.inside', { name: parent.name }) : chain.length > 1 ? t('ruleTypes.top') : t('ruleTypes.alone') }}</DlBadge>
        <span class="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" :class="ruleType.is_visible ? 'text-dl-teal' : 'text-dl-muted'">
          <span class="h-2 w-2 rounded-full bg-current" />{{ ruleType.is_visible ? t('ruleTypes.shown') : t('ruleTypes.hidden') }}
        </span>
      </span>
    </template>

    <div class="flex flex-col gap-3.5">
      <dl class="grid grid-cols-2 gap-2">
        <div v-for="tile in tiles" :key="tile.label" class="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-dl-mist px-3.5 py-2.5">
          <dt class="truncate text-[11.5px] text-dl-muted">{{ tile.label }}</dt>
          <dd class="text-[15px] font-bold tabular-nums">{{ tile.value }}</dd>
        </div>
      </dl>

      <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-[13px] text-dl-body">
        {{ !ruleType.hcp_path ? t('ruleTypes.read.whatUnlinked', { name: ruleType.name }) : ruleType.is_visible ? t('ruleTypes.read.what', { name: ruleType.name }) : t('ruleTypes.read.whatHidden', { name: ruleType.name }) }}
        <template v-if="parent && ruleType.hcp_path"> {{ t('ruleTypes.read.whatParent', { parent: parent.name }) }}</template>
      </p>

      <section v-if="chain.length > 1" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-2 text-sm font-semibold">{{ t('ruleTypes.read.where') }}</h3>
        <div class="flex flex-wrap items-center gap-2">
          <template v-for="(item, index) in chain" :key="item.code">
            <span v-if="index" class="text-dl-muted rtl:-scale-x-100" aria-hidden="true">›</span>
            <span class="inline-flex h-8 items-center rounded-[10px] border px-2.5 text-[13px] font-semibold" :class="item.code === ruleType.code ? 'border-dl-ink bg-dl-ink text-dl-on-ink dark:border-dl-fg dark:bg-dl-fg dark:text-dl-mist' : 'border-dl-line'">{{ item.name }}</span>
          </template>
        </div>
      </section>

      <section v-if="ruleType.supports_sub_zone || ruleType.supports_zone_type" class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px]">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('ruleTypes.read.extras') }}</h3>
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5">
          <template v-if="ruleType.supports_sub_zone">
            <dt class="text-dl-muted">{{ t('ruleTypes.subZones') }}</dt>
            <dd>{{ t('ruleTypes.read.subZones', { n: n(ruleType.sub_zones_count ?? 0) }) }}</dd>
          </template>
          <template v-if="ruleType.supports_zone_type">
            <dt class="text-dl-muted">{{ t('ruleTypes.zoneType') }}</dt>
            <dd>{{ t('ruleTypes.read.zoneType', { list: ['RE', 'SR', 'HR'].map(code => t(`ruleTypes.zoneTypes.${code}`)).join(', ') }) }}</dd>
          </template>
        </dl>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px]">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('ruleTypes.link.title') }}</h3>
        <dl v-if="ruleType.hcp_path" class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5">
          <dt class="text-dl-muted">{{ t('ruleTypes.link.how') }}</dt><dd>{{ linkSteps(ruleType.hcp_path) }}</dd>
          <template v-if="ruleType.supports_sub_zone && ruleType.hcp_sub_path">
            <dt class="text-dl-muted">{{ t('ruleTypes.subZones') }}</dt><dd>{{ linkSteps(ruleType.hcp_sub_path) }}</dd>
          </template>
          <dt class="text-dl-muted">{{ t('ruleTypes.link.appliesTo') }}</dt><dd>{{ appliesTo }}</dd>
        </dl>
        <p v-else class="text-dl-pending">{{ t('ruleTypes.link.none') }}</p>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px]">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('ruleTypes.userLink.title') }}</h3>
        <dl v-if="ruleType.user_path" class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5">
          <dt class="text-dl-muted">{{ t('ruleTypes.link.how') }}</dt><dd>{{ linkSteps(ruleType.user_path, 'userLink') }}</dd>
          <template v-if="ruleType.supports_sub_zone && ruleType.user_sub_path">
            <dt class="text-dl-muted">{{ t('ruleTypes.subZones') }}</dt><dd>{{ linkSteps(ruleType.user_sub_path, 'userLink') }}</dd>
          </template>
          <dt class="text-dl-muted">{{ t('ruleTypes.userLink.without') }}</dt>
          <dd>{{ ruleType.user_skip_empty ? t('ruleTypes.userLink.skips') : t('ruleTypes.userLink.notSuggested') }}</dd>
        </dl>
        <p v-else class="text-dl-muted">{{ t('ruleTypes.userLink.none') }}</p>
      </section>

      <section v-if="sources.length" class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px]">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('ruleTypes.read.source') }}</h3>
        <p v-for="source in sources" :key="source.level.route">
          {{ t('nav.workspaces.studio') }} › {{ t(source.section.label) }} › {{ t(source.level.label) }}
          <RouterLink v-if="canShow(source.level.resource)" :to="{ name: source.level.route }" class="ms-1 font-semibold text-dl-cobalt">{{ t('ruleTypes.read.open') }} ›</RouterLink>
        </p>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px]">
        <h3 class="mb-1 text-sm font-semibold">{{ t('ruleTypes.read.territories') }}</h3>
        <ul v-if="territories.length" class="flex flex-col">
          <li v-for="territory in territories" :key="territory.id" class="border-b border-dl-line-soft last:border-0">
            <RouterLink
              v-if="canShow('territories')"
              :to="{ name: 'tenant-territory-detail', params: { id: territory.id } }"
              class="flex items-center justify-between gap-2 py-2 hover:text-dl-cobalt"
            >
              <span>{{ territory.name }}</span><span class="shrink-0 text-dl-muted">{{ picked(territory) }} ›</span>
            </RouterLink>
            <span v-else class="flex items-center justify-between gap-2 py-2"><span>{{ territory.name }}</span><span class="shrink-0 text-dl-muted">{{ picked(territory) }}</span></span>
          </li>
        </ul>
        <p v-else class="text-dl-muted">{{ t('ruleTypes.read.noTerritory') }}</p>
        <RouterLink
          v-if="canShow('territories') && (ruleType.territories_count ?? 0) > territories.length"
          :to="{ name: 'tenant-territories', query: { rule_type: ruleType.code } }"
          class="mt-1 inline-block font-semibold text-dl-cobalt"
        >
          {{ t('ruleTypes.read.seeAll', { n: n(ruleType.territories_count ?? 0) }) }} ›
        </RouterLink>
      </section>
    </div>

    <template #footer>
      <p class="flex items-start gap-2 text-[12.5px] text-dl-muted"><DlIcon icon="tabler-lock" :size="16" class="mt-px shrink-0" />{{ t('ruleTypes.read.locked') }}</p>
    </template>
  </DlRecordPanel>
</template>

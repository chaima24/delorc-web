<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Territory } from '@/api/tenant/territories'
import { ZONE_TONES, useTerritoryText } from './territoryText'

// What a territory covers, read only: one group per rule type; each wilaya with its residence level.
const props = withDefaults(defineProps<{ territory: Territory; max?: number }>(), { max: 6 })
const { t, n } = useI18n()
const text = useTerritoryText()

const zones = computed(() => new Map((props.territory.zones ?? []).map(zone => [zone.wilaya_id, zone])))
/** Residence levels of wilayas that are not picked themselves (their communes or sub-zones are). */
const otherZones = computed(() => {
  const picked = new Set((props.territory.covers ?? []).flatMap(cover => cover.items.filter(item => !item.is_sub_zone && zones.value.has(item.id) && cover.items.length).map(item => item.id)))
  return (props.territory.zones ?? []).filter(zone => !picked.has(zone.wilaya_id))
})
</script>

<template>
  <div class="flex flex-col gap-2.5 text-[13px]">
    <p v-if="!territory.covers?.length" class="text-dl-muted">{{ t('territories.covers.nothing') }}</p>
    <div v-for="cover in territory.covers" :key="cover.type">
      <h4 class="mb-1 text-xs font-semibold text-dl-muted">
        {{ cover.name }} · {{ n(cover.items.length) }}
        <span v-if="!cover.linked" class="font-normal text-dl-pending">· {{ t('territories.covers.notLinked') }}</span>
      </h4>
      <ul class="flex flex-wrap gap-1.5">
        <li v-for="item in cover.items.slice(0, max)" :key="`${item.is_sub_zone}-${item.id}`" class="inline-flex items-center gap-1.5 rounded-lg bg-dl-mist px-2 py-1">
          {{ item.name }}
          <span v-if="!item.is_sub_zone && zones.get(item.id)" class="rounded-full px-1.5 text-[11px] font-semibold" :class="ZONE_TONES[zones.get(item.id)!.type]">{{ text.zone(zones.get(item.id)!.type) }}</span>
        </li>
        <li v-if="cover.items.length > max" class="px-1 py-1 text-dl-muted">{{ t('territories.covers.more', { n: n(cover.items.length - max) }) }}</li>
      </ul>
    </div>
    <div v-if="otherZones.length">
      <h4 class="mb-1 text-xs font-semibold text-dl-muted">{{ t('territories.covers.residence') }}</h4>
      <ul class="flex flex-wrap gap-1.5">
        <li v-for="zone in otherZones" :key="zone.wilaya_id" class="inline-flex items-center gap-1.5 rounded-lg bg-dl-mist px-2 py-1">
          {{ zone.name }}<span class="rounded-full px-1.5 text-[11px] font-semibold" :class="ZONE_TONES[zone.type]">{{ text.zone(zone.type) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

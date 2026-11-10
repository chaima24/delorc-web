<script setup lang="ts">
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ListParams } from '@/api/tenant/geography'
import { fetchHcpMapPoints, type HcpMapPoint, type HcpType } from '@/api/tenant/hcps'
import DlButton from '@/components/DlButton.vue'
import { useHcpText } from './hcpForm'

// Map of the professionals matching the list's tab and filters (OpenStreetMap tiles, no key). Close pins
// group into numbered circles. A click opens the record: `open` on a computer, a small card on a phone.
// Mockup: docs/design/customers-mockups/HcpMap.html
const props = defineProps<{ query: ListParams; selectedId?: number | null }>()
const emit = defineEmits<{ open: [id: number]; noGps: [] }>()
const { t, n } = useI18n()
const text = useHcpText()

// The map draws its own points: colours are read from the dl-* tokens (they follow the dark theme too).
const token = (name: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(`--dl-${name}`).trim()})`
const COLORS: Record<string, string> = { people: 'cobalt', pharmacy: 'teal', trade: 'muted' }
const kind = (type: HcpType | null) => (type === 'pharmacie' ? 'pharmacy' : type === 'wholestore' || type === 'distributor' ? 'trade' : 'people')
const ALGERIA: L.LatLngBoundsExpression = [[19, -9], [37.2, 12]]

const el = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let cluster: L.MarkerClusterGroup | null = null
const markers = new Map<number, L.CircleMarker>()
const points = shallowRef<HcpMapPoint[]>([])
const withoutGps = ref(0)
const loading = ref(false)
const picked = ref<HcpMapPoint | null>(null)
const phone = window.matchMedia('(max-width: 767px)')

function style(point: HcpMapPoint, selected: boolean): L.CircleMarkerOptions {
  return { radius: selected ? 11 : 7, color: token('paper'), weight: 2, fillColor: token(COLORS[kind(point.type)]!), fillOpacity: 1 }
}

function draw(fit: boolean) {
  if (!map || !cluster) return
  cluster.clearLayers()
  markers.clear()
  const layers = points.value.map(point => {
    const marker = L.circleMarker([point.lat, point.lng], style(point, point.id === props.selectedId))
    marker.bindTooltip(point.name, { direction: 'top', offset: [0, -6] })
    marker.on('click', () => {
      if (phone.matches) picked.value = point
      else emit('open', point.id)
    })
    markers.set(point.id, marker)
    return marker
  })
  cluster.addLayers(layers)
  if (fit && layers.length) map.fitBounds(cluster.getBounds(), { padding: [40, 40], maxZoom: 15 })
}

let request = 0
async function load(fit = true) {
  const current = ++request
  loading.value = true
  try {
    const data = await fetchHcpMapPoints(props.query)
    if (current !== request) return
    points.value = data.points
    withoutGps.value = data.without_gps
    picked.value = null
    draw(fit)
  }
  finally {
    if (current === request) loading.value = false
  }
}

onMounted(() => {
  if (!el.value) return
  map = L.map(el.value, { zoomControl: true, attributionControl: true }).fitBounds(ALGERIA)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)
  cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    iconCreateFunction: group => {
      const count = group.getChildCount()
      const size = count < 10 ? 34 : count < 100 ? 40 : 48
      return L.divIcon({ html: `<span>${count}</span>`, className: 'flex! items-center justify-center rounded-full bg-[rgba(15,31,28,0.85)] text-[13px] font-bold text-white shadow-[0_0_0_6px_rgba(15,31,28,0.18)]', iconSize: [size, size] })
    },
  })
  map.addLayer(cluster)
  load()
})
onBeforeUnmount(() => {
  map?.remove()
  map = null
})

watch(() => JSON.stringify(props.query), () => load())
watch(() => props.selectedId, (id, previous) => {
  for (const [key, value] of [[previous, false], [id, true]] as const) {
    const point = points.value.find(p => p.id === key)
    if (point) markers.get(point.id)?.setStyle(style(point, value))
  }
})

const legend = computed(() => [
  { key: 'people', label: t('hcps.map.people') },
  { key: 'pharmacy', label: t('hcps.map.pharmacies') },
  { key: 'trade', label: t('hcps.map.trade') },
])
</script>

<template>
  <div class="relative isolate h-[560px] overflow-hidden rounded-3xl bg-dl-mist max-md:h-[calc(100dvh-360px)] max-md:min-h-[360px]">
    <div ref="el" class="h-full w-full" :aria-label="t('hcps.map.label')" role="application" />

    <ul class="absolute bottom-3.5 start-3.5 z-[500] flex flex-col gap-1.5 rounded-2xl bg-dl-paper px-3 py-2.5 text-[12.5px] shadow-[0_6px_20px_-10px_rgba(0,0,0,0.3)] max-md:hidden">
      <li v-for="item in legend" :key="item.key" class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-full" :style="{ background: token(COLORS[item.key]!) }" aria-hidden="true" />{{ item.label }}
      </li>
    </ul>

    <p class="absolute end-3.5 top-3.5 z-[500] rounded-xl bg-dl-paper px-3 py-2 text-[12.5px] shadow-[0_6px_20px_-10px_rgba(0,0,0,0.3)] max-md:start-14 max-md:end-3 md:bottom-3.5 md:top-auto">
      <template v-if="loading">{{ t('hcps.map.loading') }}</template>
      <template v-else>
        {{ t('hcps.map.shown', { n: n(points.length) }, points.length) }}
        <template v-if="withoutGps">
          · <strong>{{ t('hcps.map.withoutGps', { n: n(withoutGps) }, withoutGps) }}</strong>
          · <button type="button" class="font-semibold text-dl-cobalt hover:underline" @click="emit('noGps')">{{ t('hcps.map.seeThem') }}</button>
        </template>
      </template>
    </p>

    <!-- Phone: a small card for the tapped pin -->
    <div v-if="picked" class="absolute inset-x-2.5 bottom-2.5 z-[600] flex items-center gap-3 rounded-[18px] bg-dl-paper px-3.5 py-3 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.35)]">
      <span class="flex min-w-0 flex-1 flex-col">
        <strong class="truncate">{{ picked.name }}</strong>
        <span class="truncate text-xs text-dl-muted">{{ text.type(picked.type) }}</span>
      </span>
      <button type="button" class="px-1 text-dl-muted" :aria-label="t('common.actions.close')" @click="picked = null">✕</button>
      <DlButton variant="dark" size="sm" :to="{ name: 'tenant-hcp-detail', params: { id: picked.id } }">{{ t('hcps.map.open') }}</DlButton>
    </div>
  </div>
</template>


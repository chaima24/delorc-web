<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Territory } from '@/api/tenant/territories'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useAuthStore } from '@/stores/auth'
import TerritoryCoversSection from './TerritoryCoversSection.vue'
import TerritoryDetailsSection from './TerritoryDetailsSection.vue'
import TerritoryPeople from './TerritoryPeople.vue'
import { useTerritoryDelete } from './useTerritoryDelete'

// A territory in the side panel: 3 figures, Covers and Details (each with its Edit), who works it,
// its full page, Delete. Mockup: docs/design/customers-mockups/Territories.html (frame 2)
const props = defineProps<{ territory: Territory }>()
const emit = defineEmits<{ changed: []; deleted: []; open: [id: number] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const auth = useAuthStore()
const canDelete = (resource: string) => auth.can(`${resource}.delete`)
const { remove } = useTerritoryDelete()

const tiles = computed(() => [
  { label: t('territories.figures.hcps'), value: n(props.territory.hcps_count ?? 0) },
  { label: t('territories.figures.people'), value: n(props.territory.people?.length ?? 0) },
  { label: t('territories.figures.under'), value: n(props.territory.activity?.children ?? props.territory.children_count ?? 0) },
])

async function onDelete() {
  if (await remove(props.territory)) emit('deleted')
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="territory.name">
    <template #media>
      <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-dl-signal text-dl-ink"><DlIcon icon="tabler-map-pins" :size="26" /></span>
    </template>
    <template #badges>
      <span class="mt-1 flex flex-wrap items-center gap-1.5">
        <DlBadge size="sm">{{ territory.parent ? t('territories.position.in', { name: territory.parent.name }) : t('territories.position.top') }}</DlBadge>
        <span v-if="territory.sector" class="text-xs text-dl-muted">{{ t('territories.fields.sector') }}: {{ territory.sector }}</span>
      </span>
    </template>
    <template #actions>
      <DlButton :to="{ name: 'tenant-territory-detail', params: { id: territory.id } }" variant="outline" size="sm" icon="tabler-arrows-maximize">{{ t('territories.fullPage') }}</DlButton>
    </template>

    <div class="flex flex-col gap-3.5">
      <dl class="grid grid-cols-3 gap-2">
        <div v-for="tile in tiles" :key="tile.label" class="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-dl-mist px-3.5 py-2.5">
          <dt class="truncate text-[11.5px] text-dl-muted">{{ tile.label }}</dt>
          <dd class="text-[15px] font-bold tabular-nums">{{ tile.value }}</dd>
        </div>
      </dl>
      <TerritoryCoversSection :territory="territory" @changed="emit('changed')" />
      <TerritoryPeople :territory-id="territory.id" :covers="territory.covers" :limit="2" @changed="emit('changed')" />
      <TerritoryDetailsSection :territory="territory" @changed="emit('changed')" @open="id => emit('open', id)" />
    </div>

    <template v-if="canDelete('territories')" #footer>
      <DlButton variant="danger" icon="tabler-trash" @click="onDelete">{{ t('common.actions.delete') }}</DlButton>
      <span class="text-xs text-dl-muted">{{ t('territories.delete.rule') }}</span>
    </template>
  </DlRecordPanel>
</template>

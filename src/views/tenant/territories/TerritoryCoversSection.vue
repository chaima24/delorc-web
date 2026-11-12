<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { Territory } from '@/api/tenant/territories'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useAuthStore } from '@/stores/auth'
import CoversView from './CoversView.vue'

// "Covers" section (panel and full page): what the territory covers, links to its professionals;
// Edit opens the covers page (TerritoryCoversEditView).
withDefaults(defineProps<{ territory: Territory; links?: boolean }>(), { links: true })
const { t, n } = useI18n()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const canShow = (resource: string) => auth.can(`${resource}.show`)
</script>

<template>
  <DlRecordSection :title="t('territories.covers.title')" :can-edit="canUpdate('territories')" :edit-to="{ name: 'tenant-territory-covers', params: { id: territory.id } }">
    <CoversView :territory="territory" />
    <p v-if="links && canShow('hcps') && territory.hcps_count" class="mt-2.5 text-[13px]">
      <RouterLink :to="{ name: 'tenant-hcps', query: { territory: territory.id } }" class="font-semibold text-dl-cobalt">{{ t('territories.seeHcps', { n: n(territory.hcps_count) }, territory.hcps_count) }} ›</RouterLink>
      <span class="text-dl-muted"> · </span>
      <RouterLink :to="{ name: 'tenant-hcps', query: { territory: territory.id, view: 'map' } }" class="font-semibold text-dl-cobalt">{{ t('territories.onMap') }} ›</RouterLink>
    </p>
  </DlRecordSection>
</template>

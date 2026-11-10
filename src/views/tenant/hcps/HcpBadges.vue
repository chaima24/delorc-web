<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Hcp } from '@/api/tenant/hcps'
import DlBadge from '@/components/DlBadge.vue'
import { useHcpText } from './hcpForm'

// Type, main speciality, status and "verified" under a professional's name.
defineProps<{ hcp: Hcp }>()
const { t } = useI18n()
const text = useHcpText()
const TONES = { active: 'success', inactive: 'neutral', pending: 'warning', refused: 'danger' } as const
</script>

<template>
  <span class="flex flex-wrap items-center gap-1.5">
    <DlBadge size="sm">{{ text.type(hcp.type) }}</DlBadge>
    <DlBadge v-if="text.mainWorkplace(hcp).speciality" size="sm">{{ text.mainWorkplace(hcp).speciality }}</DlBadge>
    <DlBadge size="sm" :tone="TONES[hcp.status ?? 'active']" dot>{{ t(`hcps.status.${hcp.status ?? 'active'}`) }}</DlBadge>
    <DlBadge v-if="hcp.verified" size="sm" tone="info" icon="tabler-rosette-discount-check">{{ t('hcps.verified') }}</DlBadge>
  </span>
</template>

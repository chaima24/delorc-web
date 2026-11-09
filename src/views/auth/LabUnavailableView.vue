<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DlIcon from '@/components/DlIcon.vue'
import { useLabStore } from '@/stores/lab'

/** No sign-in form: the address is not a lab, or the lab is suspended. */
const { t } = useI18n()
const labStore = useLabStore()

const kind = computed(() => (labStore.state === 'suspended' ? 'suspended' : 'unknown'))
const address = window.location.hostname
</script>

<template>
  <div class="flex flex-col gap-3">
    <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-dl-pending/12 text-dl-pending">
      <DlIcon :icon="kind === 'suspended' ? 'tabler-lock' : 'tabler-map-pin-off'" :size="24" />
    </span>
    <h1 class="font-display text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em]">{{ t(`auth.lab.${kind}Title`) }}</h1>
    <p class="text-[15px] text-dl-body">{{ t(`auth.lab.${kind}Text`, { address }) }}</p>
  </div>
</template>

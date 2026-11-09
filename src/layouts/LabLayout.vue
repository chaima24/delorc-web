<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { authApi } from '@/api/auth'
import DlIcon from '@/components/DlIcon.vue'
import LabBottomNav from './lab/LabBottomNav.vue'
import LabRail from './lab/LabRail.vue'
import LabSubnav from './lab/LabSubnav.vue'
import LabTopBar from './lab/LabTopBar.vue'

/** Lab shell: dark rail (desktop) / bottom bar (phone), top bar, workspace tabs, page. */
const { t, d } = useI18n()

/** Admins only: the lab's period has ended and it will be suspended on this day. */
const graceEndsOn = ref<string | null>(null)
onMounted(async () => {
  graceEndsOn.value = (await authApi.labAccess().catch(() => null))?.grace_ends_on ?? null
})
const graceDate = computed(() => (graceEndsOn.value ? d(new Date(`${graceEndsOn.value}T00:00:00`), { day: 'numeric', month: 'long' }) : ''))
</script>

<template>
  <div class="flex min-h-screen bg-dl-mist font-sans text-dl-fg">
    <LabRail />

    <div class="flex min-w-0 flex-1 flex-col">
      <LabTopBar />
      <!-- Cannot be closed: it goes away on the suspension date, or as soon as central adds a new period. -->
      <div v-if="graceEndsOn" role="status" class="mx-4 mt-5 flex items-start gap-3 rounded-2xl bg-dl-pending/10 px-[18px] py-3.5 text-sm leading-relaxed text-dl-pending md:mx-7">
        <DlIcon icon="tabler-alert-triangle" :size="20" class="mt-0.5 shrink-0" />
        <p><strong>{{ t('layout.grace.title') }}</strong> {{ t('layout.grace.text', { date: graceDate }) }}</p>
      </div>
      <LabSubnav />
      <main class="flex-1 px-4 pb-28 pt-6 md:px-7 md:pb-10">
        <RouterView />
      </main>
    </div>

    <LabBottomNav />
  </div>
</template>

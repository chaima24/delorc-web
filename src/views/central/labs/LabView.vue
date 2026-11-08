<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { labsApi, type Lab } from '@/api/central/labs'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSheet from '@/components/DlSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { usePanelAction } from '../geography/usePanelAction'
import LabActivity from './LabActivity.vue'
import LabFeatures from './LabFeatures.vue'
import LabLogo from './LabLogo.vue'
import LabOverview from './LabOverview.vue'
import LabSubscription from './LabSubscription.vue'
import { useLabTexts } from './useLabTexts'

const { t, d } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const { day, periodLabel, periodTone, statusLabel } = useLabTexts()
const { error: actionError, busy, run } = usePanelAction()

const lab = ref<Lab | null>(null)
const error = ref<string | null>(null)
const tab = ref<'overview' | 'subscription' | 'features' | 'activity'>('overview')
const confirming = ref<'suspend' | 'resume' | null>(null)
const reason = ref('')

const tabClass = 'flex h-[34px] items-center rounded-[11px] bg-dl-paper px-3 text-[13px] font-semibold text-dl-body'
const activeTab = 'bg-dl-signal-soft! text-dl-fg! shadow-[inset_0_0_0_1.5px_rgb(var(--dl-ink))]'
const sheetOpen = computed({ get: () => confirming.value !== null, set: (open) => { if (!open) confirming.value = null } })

onMounted(async () => {
  try {
    lab.value = await labsApi.get(String(route.params.id))
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
})

function ask(which: 'suspend' | 'resume'): void {
  reason.value = ''
  confirming.value = which
}

const confirm = () => run(
  () => (confirming.value === 'suspend' ? labsApi.suspend(lab.value!.id, reason.value || null) : labsApi.resume(lab.value!.id)),
  (changed) => {
    lab.value = changed
    confirming.value = null
  },
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <RouterLink :to="{ name: 'central-labs' }" class="text-[13px] font-semibold text-dl-muted no-underline hover:underline">{{ t('central.labs.title') }}</RouterLink>
    <DlAlert v-if="error">{{ error }}</DlAlert>

    <template v-if="lab">
      <div class="flex flex-wrap items-center gap-3.5">
        <LabLogo :name="lab.name" :url="lab.logo_url" size="lg" />
        <div class="min-w-0 flex-1">
          <h1 class="font-display text-[32px] font-extrabold leading-tight tracking-[-0.03em]">{{ lab.name }}</h1>
          <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
            <DlBadge :tone="lab.status === 'active' ? 'success' : 'warning'" dot size="sm">{{ statusLabel(lab.status) }}</DlBadge>
            <DlBadge :tone="periodTone(lab.period_status)" dot size="sm">{{ periodLabel(lab.period_status) }}</DlBadge>
            <span class="text-xs text-dl-muted">{{ lab.id }}.localhost · {{ lab.plan?.name ?? '—' }}</span>
          </div>
        </div>
        <template v-if="auth.can('labs.suspend')">
          <DlButton v-if="lab.status === 'active'" variant="outline" @click="ask('suspend')">{{ t('central.labs.suspend') }}</DlButton>
          <DlButton v-else-if="lab.suspension?.by" variant="primary" @click="ask('resume')">{{ t('central.labs.resume') }}</DlButton>
        </template>
      </div>

      <!-- Why the lab is in grace or stopped. -->
      <p v-if="lab.period_status === 'grace' && lab.status === 'active'" class="rounded-2xl bg-dl-pending/10 px-4 py-3 text-sm text-dl-pending">
        <strong>{{ t('central.labs.graceTitle', { date: day(lab.grace_ends_on) }) }}</strong><br>{{ t('central.labs.graceHint') }}
      </p>
      <p v-if="lab.suspension" class="rounded-2xl bg-dl-rejected/10 px-4 py-3 text-sm text-dl-rejected">
        <template v-if="lab.suspension.by">
          <strong>{{ t('central.labs.suspendedBy', { name: lab.suspension.by.name, date: lab.suspension.at ? d(new Date(lab.suspension.at)) : '—' }) }}</strong><br>
          <template v-if="lab.suspension.reason">{{ t('central.labs.reasonShown', { reason: lab.suspension.reason }) }} </template>{{ t('central.labs.suspendedHint') }}
        </template>
        <template v-else>
          <strong>{{ t('central.labs.suspendedAuto', { date: lab.suspension.at ? d(new Date(lab.suspension.at)) : '—' }) }}</strong><br>{{ t('central.labs.suspendedAutoHint') }}
        </template>
      </p>

      <nav class="flex flex-wrap gap-1.5" :aria-label="lab.name">
        <button v-for="name in (['overview', 'subscription', 'features', 'activity'] as const)" :key="name" type="button" :class="[tabClass, tab === name && activeTab]" @click="tab = name">
          {{ t(`central.labs.tab.${name}`) }}
        </button>
      </nav>

      <LabOverview v-if="tab === 'overview'" :lab="lab" @changed="lab = $event" />
      <LabSubscription v-else-if="tab === 'subscription'" :lab="lab" @changed="lab = $event" />
      <LabFeatures v-else-if="tab === 'features'" :lab="lab" />
      <LabActivity v-else :lab="lab" />
    </template>

    <DlSheet v-if="lab" v-model:open="sheetOpen" :title="t(`central.labs.${confirming ?? 'suspend'}Title`, { name: lab.name })">
      <div class="flex flex-col gap-3.5">
        <DlAlert v-if="actionError">{{ actionError }}</DlAlert>
        <p class="text-sm text-dl-body">{{ t(`central.labs.${confirming ?? 'suspend'}Hint`) }}</p>
        <DlInput v-if="confirming === 'suspend'" v-model="reason" :label="t('central.labs.reason')" :hint="t('central.labs.reasonHint')" />
      </div>
      <template #footer>
        <DlButton variant="outline" size="sm" @click="confirming = null">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton :variant="confirming === 'suspend' ? 'dark' : 'primary'" size="sm" :loading="busy" @click="confirm">{{ t(`central.labs.${confirming ?? 'suspend'}Confirm`) }}</DlButton>
      </template>
    </DlSheet>
  </div>
</template>

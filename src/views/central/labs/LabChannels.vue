<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { channelsApi, type LabEmail, type MailServerFields } from '@/api/central/channels'
import type { Lab } from '@/api/central/labs'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useAuthStore } from '@/stores/auth'
import ServerFields from '../channels/ServerFields.vue'
import TestSend from '../channels/TestSend.vue'
import { usePanelAction } from '../geography/usePanelAction'

/** How the lab sends email: Delorc's shared account, or its own SMTP. SMS joins this tab when a provider is chosen. */
const props = defineProps<{ lab: Lab }>()

const { t, d, n } = useI18n()
const auth = useAuthStore()
const { errors, error, busy, run, clear } = usePanelAction()

const email = ref<LabEmail | null>(null)
const loadError = ref<string | null>(null)
const editing = ref(false)
const mode = ref<'shared' | 'own'>('shared')
const form = ref<MailServerFields & { from_name: string }>({ host: '', port: 465, encryption: 'ssl', username: null, password: '', from_address: '', from_name: '' })

const usage = computed(() => email.value?.usage)
const full = computed(() => usage.value?.quota != null && usage.value.sent >= usage.value.quota)
const percent = computed(() => (usage.value?.quota ? Math.min(100, (usage.value.sent / usage.value.quota) * 100) : 0))
const nextMonth = computed(() => {
  const [year, month] = (usage.value?.month ?? '2000-01-01').split('-').map(Number)

  return d(new Date(year!, month!, 1), { dateStyle: 'medium' })
})

function reset(): void {
  const own = email.value?.own
  mode.value = email.value?.mode ?? 'shared'
  form.value = { host: own?.host ?? '', port: own?.port ?? 465, encryption: own?.encryption ?? 'ssl', username: own?.username ?? null,
    password: '', from_address: own?.from_address ?? '', from_name: own?.from_name ?? props.lab.name }
  editing.value = false
  clear()
}

onMounted(async () => {
  try {
    email.value = await channelsApi.lab(props.lab.id)
    reset()
  } catch (failure) {
    loadError.value = errorMessage(failure) ?? t('errors.network')
  }
})

const save = () => run(
  () => channelsApi.saveLabEmail(props.lab.id, mode.value === 'shared' ? { mode: 'shared' } : { mode: 'own', ...form.value }),
  (saved) => {
    email.value = saved
    reset()
  },
)
const row = 'flex items-start gap-2.5 border-t border-dl-line-soft py-2.5 first:border-t-0'
const modeCard = 'flex flex-1 cursor-pointer gap-2.5 rounded-[14px] border p-3 text-[13px] text-dl-body'
</script>

<template>
  <div class="flex flex-col gap-4">
    <DlAlert v-if="loadError">{{ loadError }}</DlAlert>
    <template v-if="email">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <DlRecordSection v-model:editing="editing" :title="t('central.channels.email')" :can-edit="auth.can('channels.update')" :saving="busy" class="bg-dl-paper" @save="save" @cancel="reset">
        <div class="mb-2 flex items-center gap-2">
          <DlBadge :tone="email.mode === 'own' ? 'info' : 'neutral'" size="sm">{{ t(`central.channels.mode.${email.mode}`) }}</DlBadge>
          <span class="text-[13px] text-dl-body">{{ t(`central.channels.modeHint.${email.mode}`) }}</span>
        </div>

        <!-- Exactly what people receive. -->
        <p v-if="email.from.address" class="rounded-[10px] bg-dl-mist px-2.5 py-2 font-mono text-[12.5px] text-dl-fg">
          {{ t('central.channels.fromLine', { name: email.from.name, address: email.from.address }) }}
          <template v-if="email.reply_to"><br>{{ t('central.channels.replyToLine', { address: email.reply_to }) }}</template>
        </p>
        <p v-else class="rounded-xl bg-dl-pending/10 px-3 py-2.5 text-[13px] text-dl-pending">{{ t('central.channels.sharedNotSet') }}</p>

        <dl v-if="email.own" class="mt-2 text-sm">
          <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.channels.server') }}</dt><dd class="font-semibold text-dl-fg">{{ email.own.host }} : {{ email.own.port }} · {{ t(`central.channels.encryption.${email.own.encryption}`) }}</dd></div>
          <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.channels.username') }}</dt><dd class="font-semibold text-dl-fg">{{ email.own.username ?? '—' }}</dd></div>
          <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.channels.password') }}</dt><dd class="font-semibold text-dl-fg">{{ email.own.password_set ? t('central.channels.saved') : '—' }}</dd></div>
        </dl>

        <p v-if="email.last_error" class="mt-2.5 rounded-xl bg-dl-rejected/10 px-3 py-2.5 text-[13px] text-dl-rejected">
          <strong>{{ t('central.channels.lastError', { date: d(new Date(email.last_error_at!), { dateStyle: 'medium', timeStyle: 'short' }) }) }}</strong>
          {{ email.last_error }} {{ t('central.channels.lastErrorHint') }}
        </p>

        <div v-if="usage" class="mt-2 border-t border-dl-line-soft pt-2.5 text-sm">
          <div class="flex">
            <span class="flex-1 font-semibold">{{ t('central.channels.thisMonth') }}</span>
            <span class="font-semibold tabular-nums" :class="full ? 'text-dl-rejected' : 'text-dl-fg'">
              {{ usage.quota === null ? t('central.channels.noLimit', { sent: n(usage.sent) }) : t('central.channels.ofQuota', { sent: n(usage.sent), quota: n(usage.quota) }) }}
            </span>
          </div>
          <div v-if="usage.quota !== null" class="mt-1.5 h-2 overflow-hidden rounded-full bg-dl-line-soft">
            <i class="block h-full rounded-full" :class="full ? 'bg-dl-rejected' : 'bg-dl-ink'" :style="{ width: `${percent}%` }" />
          </div>
          <p class="mt-1 text-xs text-dl-muted">{{ t('central.channels.usageHint') }}</p>
          <p v-if="full" class="mt-2 rounded-xl bg-dl-pending/10 px-3 py-2.5 text-[13px] text-dl-pending">
            <strong>{{ t('central.channels.quotaReached') }}</strong> {{ t('central.channels.quotaReachedHint', { date: nextMonth }) }}
          </p>
        </div>

        <TestSend v-if="auth.can('channels.test')" :send="(to) => channelsApi.testLabEmail(lab.id, to)" class="mt-2" />

        <template #edit>
          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-2.5 sm:flex-row" role="radiogroup" :aria-label="t('central.channels.email')">
              <label v-for="choice in (['shared', 'own'] as const)" :key="choice" :class="[modeCard, mode === choice ? 'border-2 border-dl-fg bg-dl-signal-soft' : 'border-dl-line']">
                <input v-model="mode" type="radio" :value="choice" class="mt-0.5 accent-[rgb(var(--dl-ink))]">
                <span><strong class="block text-sm text-dl-fg">{{ t(`central.channels.mode.${choice}`) }}</strong>{{ t(`central.channels.modeChoice.${choice}`) }}</span>
              </label>
            </div>
            <template v-if="mode === 'own'">
              <ServerFields v-model="form" :errors="errors" :password-saved="email.own?.password_set ?? false" />
              <div class="grid gap-3 sm:grid-cols-2">
                <DlInput v-model="form.from_address" type="email" :label="t('central.channels.fromAddress')" :error="errors.from_address" />
                <DlInput v-model="form.from_name" :label="t('central.channels.fromName')" :hint="t('central.channels.fromNameHint')" :error="errors.from_name" />
              </div>
            </template>
            <p v-else-if="email.mode === 'own'" class="text-xs text-dl-muted">{{ t('central.channels.backToShared') }}</p>
          </div>
        </template>
      </DlRecordSection>

      <!-- SMS joins this tab once a provider is chosen. -->
      <DlRecordSection :title="t('central.channels.sms')" :can-edit="false" class="bg-dl-paper opacity-60">
        <DlBadge tone="info" size="sm">{{ t('central.channels.smsLater') }}</DlBadge>
        <p class="mt-1.5 text-[13px]">{{ t('central.channels.smsLab') }}</p>
      </DlRecordSection>
    </template>
  </div>
</template>

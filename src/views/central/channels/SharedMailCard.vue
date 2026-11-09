<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { channelsApi, type MailServerFields, type SharedMail } from '@/api/central/channels'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useAuthStore } from '@/stores/auth'
import { usePanelAction } from '../geography/usePanelAction'
import ServerFields from './ServerFields.vue'
import TestSend from './TestSend.vue'

/** Delorc's email account: sends central's emails and those of every lab on the shared mode. */
const { t } = useI18n()
const auth = useAuthStore()
const { errors, error, busy, run, clear } = usePanelAction()

const account = ref<SharedMail | null>(null)
const loadError = ref<string | null>(null)
const editing = ref(false)
const form = ref<MailServerFields>({ host: '', port: 587, encryption: 'tls', username: null, password: '', from_address: '' })

function reset(): void {
  const saved = account.value
  form.value = { host: saved?.host ?? '', port: saved?.port ?? 587, encryption: saved?.encryption ?? 'tls',
    username: saved?.username ?? null, password: '', from_address: saved?.from_address ?? '' }
  editing.value = false
  clear()
}

onMounted(async () => {
  try {
    account.value = await channelsApi.shared()
    reset()
  } catch (failure) {
    loadError.value = errorMessage(failure) ?? t('errors.network')
  }
})

const save = () => run(() => channelsApi.saveShared(form.value), (saved) => {
  account.value = saved
  reset()
})
const row = 'flex items-start gap-2.5 border-t border-dl-line-soft py-2.5 first:border-t-0'
</script>

<template>
  <DlAlert v-if="loadError">{{ loadError }}</DlAlert>
  <template v-if="account">
    <DlAlert v-if="error">{{ error }}</DlAlert>
    <DlRecordSection v-model:editing="editing" :title="t('central.channels.sharedTitle')" :can-edit="auth.can('channels.update')" :saving="busy" class="bg-dl-paper" @save="save" @cancel="reset">
      <div class="mb-2 flex items-center gap-2">
        <DlBadge :tone="account.is_set ? 'success' : 'warning'" dot size="sm">{{ t(account.is_set ? 'central.channels.set' : 'central.channels.notSet') }}</DlBadge>
        <span class="text-[13px] text-dl-body">{{ t('central.channels.sharedHint') }}</span>
      </div>
      <p v-if="!account.is_set" class="rounded-xl bg-dl-pending/10 px-3 py-2.5 text-[13px] text-dl-pending">{{ t('central.channels.notSetHint') }}</p>
      <template v-else>
        <dl class="text-sm">
          <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.channels.server') }}</dt><dd class="font-semibold text-dl-fg">{{ account.host }} : {{ account.port }} · {{ t(`central.channels.encryption.${account.encryption}`) }}</dd></div>
          <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.channels.username') }}</dt><dd class="font-semibold text-dl-fg">{{ account.username ?? '—' }}</dd></div>
          <div :class="row">
            <dt class="flex-1"><strong class="block">{{ t('central.channels.password') }}</strong><span class="text-[12.5px] text-dl-muted">{{ t('central.channels.passwordNever') }}</span></dt>
            <dd class="font-semibold text-dl-fg">{{ account.password_set ? t('central.channels.saved') : '—' }}</dd>
          </div>
          <div :class="row">
            <dt class="flex-1"><strong class="block">{{ t('central.channels.fromAddress') }}</strong><span class="text-[12.5px] text-dl-muted">{{ t('central.channels.fromAddressHint') }}</span></dt>
            <dd class="font-semibold text-dl-fg">{{ account.from_address }}</dd>
          </div>
        </dl>
        <TestSend v-if="auth.can('channels.test')" :send="channelsApi.testShared" />
      </template>
      <template #edit>
        <div class="flex flex-col gap-3">
          <ServerFields v-model="form" :errors="errors" :password-saved="account.password_set" />
          <DlInput v-model="form.from_address" type="email" :label="t('central.channels.fromAddress')" :error="errors.from_address" />
        </div>
      </template>
    </DlRecordSection>
  </template>
</template>

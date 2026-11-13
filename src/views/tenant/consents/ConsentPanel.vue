<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { deleteConsent, sendConsentLink, updateConsent, type Consent } from '@/api/tenant/consents'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { avatarName } from '@/views/tenant/hcps/hcpForm'
import ConsentQr from './ConsentQr.vue'
import { STATE_TONES, useConsentText } from './consentText'

// A consent in the side panel. Waiting: the QR code to show, the private link (copy, download the QR,
// send by e-mail), Deactivate / Delete. Answered: what, when, contact confirmed, device — kept as proof.
// Mockup: docs/design/customers-mockups/Consents.html (frames 3–4)
const props = defineProps<{ consent: Consent }>()
const emit = defineEmits<{ changed: []; deleted: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const canDelete = (resource: string) => auth.can(`${resource}.delete`)
const canStore = (resource: string) => auth.can(`${resource}.create`)
const text = useConsentText()

const qr = ref<InstanceType<typeof ConsentQr> | null>(null)
async function copy() {
  if (!props.consent.link) return
  try {
    await navigator.clipboard.writeText(props.consent.link)
    toast.success(t('consents.panel.copied'))
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}
function download() {
  const src = qr.value?.src
  if (!src) return
  const a = document.createElement('a')
  a.href = src
  a.download = `${t('consents.panel.qrFile')} - ${props.consent.hcp?.name ?? props.consent.id}.png`
  a.click()
}

// Send by e-mail: to the professional's e-mail, or one typed here.
const sending = ref(false)
const showMail = ref(false)
const email = ref('')
const emailError = ref('')
watch(() => props.consent.id, () => {
  showMail.value = false
  email.value = props.consent.hcp?.email ?? ''
  emailError.value = ''
}, { immediate: true })
async function send() {
  sending.value = true
  emailError.value = ''
  try {
    const sentTo = (await sendConsentLink(props.consent.id, email.value.trim())).sent_to
    toast.success(t('consents.panel.sent', { email: sentTo }))
    showMail.value = false
  }
  catch (error) {
    const found = Object.values(fieldErrors(error))[0]
    if (found) emailError.value = found
    else toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    sending.value = false
  }
}

const busy = ref(false)
async function setActive(active: boolean) {
  if (!active) {
    const ok = await confirm({
      title: t(props.consent.state === 'given' ? 'consents.panel.withdrawTitle' : 'consents.panel.deactivateTitle'),
      text: t(props.consent.state === 'given' ? 'consents.panel.withdrawText' : 'consents.panel.deactivateText'),
      confirmButtonText: t(props.consent.state === 'given' ? 'consents.panel.withdraw' : 'consents.panel.deactivate'),
      icon: 'warning',
    })
    if (!ok) return
  }
  busy.value = true
  try {
    await updateConsent(props.consent.id, { is_active: active })
    toast.success(t('studio.list.toast.saved'))
    emit('changed')
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    busy.value = false
  }
}
async function remove() {
  const ok = await confirm({ title: t('consents.panel.deleteTitle'), text: t('consents.panel.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteConsent(props.consent.id)
    toast.success(t('studio.list.toast.deleted'))
    emit('deleted')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="consent.hcp?.name ?? `#${consent.id}`">
    <template #media><DlAvatar :name="avatarName(consent.hcp?.name ?? '?')" size="lg" tone="signal" /></template>
    <template #badges>
      <span class="mt-1 flex"><DlBadge size="sm" :tone="STATE_TONES[consent.state]" dot>{{ text.state(consent.state) }}</DlBadge></span>
    </template>

    <div class="flex flex-col gap-3.5 text-[13px]">
      <template v-if="consent.state === 'waiting' && consent.link">
        <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-body">{{ t('consents.panel.waitingHint', { asked: text.asked(consent) }) }}</p>
        <div class="flex justify-center"><ConsentQr ref="qr" :link="consent.link" :label="t('consents.panel.qrLabel', { name: consent.hcp?.name ?? '' })" /></div>
        <div class="flex items-center gap-2 rounded-xl border border-dl-line px-3 py-2">
          <span class="min-w-0 flex-1 truncate text-xs text-dl-body" dir="ltr">{{ consent.link }}</span>
          <DlButton variant="outline" size="sm" @click="copy">{{ t('consents.panel.copy') }}</DlButton>
        </div>
        <div class="flex flex-wrap gap-2">
          <DlButton variant="outline" size="sm" icon="tabler-download" @click="download">{{ t('consents.panel.download') }}</DlButton>
          <DlButton v-if="canStore('consents')" variant="outline" size="sm" icon="tabler-mail" @click="showMail = !showMail">{{ t('consents.panel.sendByMail') }}</DlButton>
        </div>
        <form v-if="showMail" class="flex flex-col gap-2 rounded-xl border border-dl-line p-3" @submit.prevent="send">
          <DlInput v-model="email" type="email" :label="t('consents.panel.mailTo')" :error="emailError" />
          <div class="flex justify-end gap-2">
            <DlButton variant="outline" size="sm" @click="showMail = false">{{ t('common.actions.cancel') }}</DlButton>
            <DlButton type="submit" variant="dark" size="sm" :loading="sending">{{ t('consents.panel.send') }}</DlButton>
          </div>
        </form>
      </template>

      <section v-if="consent.is_signed" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('consents.panel.answer') }}</h3>
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5">
          <dt class="text-dl-muted">{{ t('consents.panel.answer') }}</dt><dd>{{ t(consent.approval ? 'consents.panel.agrees' : 'consents.panel.refuses') }}</dd>
          <dt class="text-dl-muted">{{ t('consents.panel.signed') }}</dt><dd>{{ text.dateTime(consent.signed_at) }}</dd>
          <dt class="text-dl-muted">{{ t('hcps.fields.email') }}</dt><dd class="break-all">{{ consent.email || '—' }}</dd>
          <dt class="text-dl-muted">{{ t('hcps.fields.phone') }}</dt><dd>{{ consent.phone || '—' }}</dd>
          <template v-if="consent.contacted_by"><dt class="text-dl-muted">{{ t('hcps.fields.prefers') }}</dt><dd>{{ t(`hcps.contactedBy.${consent.contacted_by}`) }}</dd></template>
          <dt class="text-dl-muted">{{ t('consents.panel.device') }}</dt><dd class="break-words">{{ [consent.user_agent, consent.ip_address].filter(Boolean).join(' · ') || '—' }}</dd>
        </dl>
      </section>

      <section v-if="consent.is_signed && consent.approval" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('consents.panel.proof') }}</h3>
        <p v-if="consent.verified_via" class="flex items-start gap-2">
          <DlIcon icon="tabler-shield-check" :size="17" class="mt-px shrink-0 text-dl-teal" />
          <span>{{ t(`consents.panel.verified.${consent.verified_via}`, { email: consent.verified_to ?? '', channel: t(`consents.panel.channel.${consent.verified_channel ?? 'email'}`) }) }}</span>
        </p>
        <p v-else class="flex items-start gap-2 text-dl-muted">
          <DlIcon icon="tabler-shield-question" :size="17" class="mt-px shrink-0" />{{ t('consents.panel.notVerified') }}
        </p>
        <figure v-if="consent.signature" class="mt-2.5 flex flex-col gap-1">
          <img :src="consent.signature" :alt="t('consents.panel.signatureOf', { name: consent.hcp?.name ?? '' })" class="h-24 w-full rounded-xl border border-dl-line bg-white object-contain">
          <figcaption class="text-xs text-dl-muted">{{ t('consents.panel.signatureCaption') }}</figcaption>
        </figure>
        <p v-else class="mt-1.5 text-xs text-dl-muted">{{ t('consents.panel.noSignature') }}</p>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('consents.panel.request') }}</h3>
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5">
          <dt class="text-dl-muted">{{ t('consents.panel.asked') }}</dt><dd>{{ text.asked(consent) }}</dd>
        </dl>
      </section>

      <p v-if="consent.is_signed" class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('consents.panel.keptAsProof') }}</p>
    </div>

    <template #footer>
      <DlButton v-if="canUpdate('consents') && consent.is_active && consent.state !== 'refused'" variant="outline" :loading="busy" @click="setActive(false)">
        {{ t(consent.state === 'given' ? 'consents.panel.withdraw' : 'consents.panel.deactivate') }}
      </DlButton>
      <DlButton variant="ghost" icon-end="tabler-arrow-up-right" :to="{ name: 'tenant-hcp-detail', params: { id: consent.hcp?.id }, query: { tab: 'consents' } }">{{ t('consents.panel.openHcp') }}</DlButton>
      <DlButton v-if="canDelete('consents') && !consent.is_signed" variant="ghost" class="ms-auto text-dl-rejected!" @click="remove">{{ t('common.actions.delete') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

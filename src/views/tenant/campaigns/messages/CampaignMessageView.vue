<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  approveMessage, deleteCampaignMessage, deleteCampaignMessageFile, fetchCampaignMessage, markMessageReady, sendMessageBack,
  testCampaignMessage, updateCampaignMessage, uploadCampaignMessageImage, type CampaignMessage,
} from '@/api/tenant/campaignMessages'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import MailEditor from './MailEditor.vue'
import MailFilesCard from './MailFilesCard.vue'
import MailPreview from './MailPreview.vue'
import { CHANNEL_ICON, STATUS_TONE, useMessageText } from './messageDisplay'

// An email or SMS of a campaign: written beside its preview, marked ready, approved or sent back by someone else.
// A draft or a returned message is edited straight away; a ready or approved one after "Modifier" (it goes back to
// draft). Mockup: docs/design/campaigns-mockups/Messages.html (frames 3 to 9)
const props = defineProps<{ id: string; messageId: string }>()
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useMessageText()

const message = ref<CampaignMessage | null>(null)
const failed = ref(false)
const form = ref({ subject: '', body: '' })
const errors = ref<Record<string, string>>({})
const unlocked = ref(false)
function take(value: CampaignMessage) {
  message.value = value
  form.value = { subject: value.subject ?? '', body: value.body ?? '' }
  errors.value = {}
}
async function load() {
  failed.value = false
  try {
    take(await fetchCampaignMessage(Number(props.messageId)))
    unlocked.value = false
  }
  catch {
    failed.value = true
  }
}
watch(() => props.messageId, load, { immediate: true })

const isSms = computed(() => message.value?.channel === 'sms')
const canWrite = computed(() => !!message.value?.can.update)
const canApproveRight = computed(() => auth.can('campaign-messages.approve'))
const locked = computed(() => ['ready', 'approved'].includes(message.value?.status ?? ''))
const editable = computed(() => canWrite.value && (!locked.value || unlocked.value))
const dirty = computed(() => !!message.value && (form.value.subject !== (message.value.subject ?? '') || form.value.body !== (message.value.body ?? '')))
const back = computed(() => ({ name: 'tenant-campaign', params: { id: props.id }, query: { tab: 'messages' } }))
const STEPS = ['draft', 'ready', 'approved'] as const

/** Saving the draft; a busy flag per action, so each button shows its own spinner. */
const busy = ref<string | null>(null)
async function run<T>(key: string, action: () => Promise<T>, done?: string): Promise<T | null> {
  busy.value = key
  try {
    const result = await action()
    if (done) toast.success(done)
    return result
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
    return null
  }
  finally {
    busy.value = null
  }
}
async function save(quiet = false) {
  if (!message.value) return false
  const saved = await run('save', () => updateCampaignMessage(message.value!.id, { subject: form.value.subject || null, body: form.value.body || null }), quiet ? undefined : t('campaignMessages.page.saved'))
  if (saved) await load()
  return !!saved
}
async function ready() {
  if (dirty.value && !(await save(true))) return
  const result = await run('ready', () => markMessageReady(message.value!.id), t('campaignMessages.page.readyDone'))
  if (result) await load()
}
async function approve() {
  const result = await run('approve', () => approveMessage(message.value!.id), t('campaignMessages.page.approvedDone'))
  if (result) await load()
}
async function unlock() {
  if (message.value?.status === 'approved') {
    const ok = await confirm({ title: t('campaignMessages.page.unlockTitle'), text: t('campaignMessages.page.unlockText', { name: message.value.approved_by?.full_name ?? '' }), confirmButtonText: t('campaignMessages.page.unlockConfirm'), icon: 'warning' })
    if (!ok) return
  }
  unlocked.value = true
}
async function test() {
  const ok = await confirm({ title: t('campaignMessages.test.title'), text: t('campaignMessages.test.text', { email: auth.user?.email ?? '' }), confirmButtonText: t('campaignMessages.test.send'), icon: 'question' })
  if (!ok || (dirty.value && !(await save(true)))) return
  await run('test', () => testCampaignMessage(message.value!.id), t('campaignMessages.test.done', { email: auth.user?.email ?? '' }))
}
async function remove() {
  const ok = await confirm({ title: t('campaignMessages.page.deleteTitle'), text: t('campaignMessages.page.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  if (await run('delete', () => deleteCampaignMessage(message.value!.id), t('studio.list.toast.deleted')) !== null) router.push(back.value)
}
async function addFiles(files: File[]) {
  if (await run('files', () => updateCampaignMessage(message.value!.id, { attachments: files }))) await load()
}
async function removeFile(fileId: number) {
  if (await run('files', () => deleteCampaignMessageFile(message.value!.id, fileId))) await load()
}
const uploadImage = async (file: File) => (await uploadCampaignMessageImage(message.value!.id, file)).url

// "Renvoyer": the reason is required.
const returning = ref(false)
const reason = ref('')
async function sendBack() {
  const result = await run('return', () => sendMessageBack(message.value!.id, reason.value.trim()), t('campaignMessages.page.returnedDone'))
  if (!result) return
  returning.value = false
  reason.value = ''
  await load()
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('campaignMessages.page.notFound')">
      <DlButton variant="outline" :to="back">{{ t('campaignMessages.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!message">
      <DlSkeleton class="h-24 rounded-3xl" />
      <div class="grid gap-4 lg:grid-cols-2"><DlSkeleton class="h-96 rounded-3xl" /><DlSkeleton class="h-96 rounded-3xl" /></div>
    </template>

    <template v-else>
      <div class="flex flex-col gap-2">
        <nav class="flex flex-wrap items-center gap-1.5 text-[13px] text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
          <RouterLink :to="{ name: 'tenant-campaigns' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('campaigns.list.title') }}</RouterLink>
          <DlIcon icon="tabler-chevron-right" :size="14" />
          <RouterLink :to="back" class="text-dl-muted no-underline hover:text-dl-fg">{{ message.campaign?.name }} · {{ t('campaigns.tabs.messages') }}</RouterLink>
        </nav>
        <div class="flex flex-wrap items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-dl-cobalt/10 text-dl-cobalt"><DlIcon :icon="CHANNEL_ICON[message.channel]" :size="20" /></span>
          <h1 class="min-w-0 font-display text-[24px] font-extrabold leading-tight tracking-[-0.02em] md:text-[28px]">{{ text.fields(message.subject) || t('campaignMessages.list.noSubject') }}</h1>
          <DlBadge :tone="STATUS_TONE[message.status]" dot>{{ text.status(message.status) }}</DlBadge>
          <div class="ms-auto flex flex-wrap gap-2">
            <DlButton v-if="!isSms" variant="outline" icon="tabler-mail-forward" :loading="busy === 'test'" @click="test">{{ t('campaignMessages.test.button') }}</DlButton>
            <DlButton v-if="message.status === 'approved' && !isSms && canWrite" variant="primary" icon="tabler-send" :to="{ name: 'tenant-campaign-sending-new', params: { id }, query: { message: message.id } }">{{ t('campaignSendings.new.fromMessage') }}</DlButton>
            <template v-if="canWrite">
              <DlButton v-if="locked && !unlocked" variant="outline" icon="tabler-pencil" @click="unlock">{{ t('common.actions.edit') }}</DlButton>
              <DlButton v-if="editable" variant="outline" :disabled="!dirty" :loading="busy === 'save'" @click="save()">{{ t('campaignMessages.page.saveDraft') }}</DlButton>
              <DlButton v-if="['draft', 'returned'].includes(message.status)" variant="dark" icon-end="tabler-arrow-right" :loading="busy === 'ready'" @click="ready">{{ t('campaignMessages.page.markReady') }}</DlButton>
            </template>
            <template v-if="canApproveRight && message.status === 'ready' && !unlocked">
              <DlButton variant="outline" icon="tabler-arrow-back-up" :disabled="!message.can.approve" @click="returning = true">{{ t('campaignMessages.page.return') }}</DlButton>
              <DlButton variant="primary" icon="tabler-check" :disabled="!message.can.approve" :loading="busy === 'approve'" @click="approve">{{ t('campaignMessages.page.approve') }}</DlButton>
            </template>
          </div>
        </div>
        <span class="text-[13px] text-dl-muted">
          {{ [message.template ? t('campaignMessages.page.fromTemplate', { name: message.template.label }) : null,
              message.created_by ? t('campaignMessages.page.writtenBy', { name: message.created_by.full_name }) : null,
              t('campaignMessages.page.changedOn', { date: text.dateTime(message.updated_at) })].filter(Boolean).join(' · ') }}
        </span>
      </div>

      <ol class="flex flex-wrap items-center gap-2 text-[12.5px] text-dl-muted" :aria-label="t('campaignMessages.columns.status')">
        <li v-for="(step, i) in STEPS" :key="step" class="flex items-center gap-2">
          <span v-if="i" class="h-px w-8 bg-dl-line" aria-hidden="true" />
          <span :class="message.status === step || (step === 'draft' && message.status === 'returned') ? 'font-bold text-dl-fg' : ''">
            {{ message.status === step || (step === 'draft' && message.status === 'returned') ? '●' : '○' }} {{ text.status(step) }}
          </span>
        </li>
      </ol>

      <div v-if="message.status === 'ready'" class="flex items-center gap-3 rounded-2xl bg-dl-cobalt/8 px-4 py-3 text-[13.5px]">
        <DlIcon icon="tabler-hourglass" :size="18" />
        <span><strong>{{ t('campaignMessages.banner.ready') }}</strong> {{ canApproveRight && message.can.approve ? t('campaignMessages.banner.readyApprover', { name: message.created_by?.full_name ?? '' }) : t('campaignMessages.banner.readyWriter') }}</span>
      </div>
      <div v-if="message.status === 'returned'" class="flex items-center gap-3 rounded-2xl bg-dl-rejected/8 px-4 py-3 text-[13.5px]">
        <DlIcon icon="tabler-arrow-back-up" :size="18" />
        <span><strong>{{ t('campaignMessages.banner.returned') }}</strong> « {{ message.return_reason }} »</span>
      </div>
      <div v-if="message.status === 'approved'" class="flex items-center gap-3 rounded-2xl bg-dl-signal-soft px-4 py-3 text-[13.5px]">
        <DlIcon icon="tabler-circle-check" :size="18" />
        <span><strong>{{ t('campaignMessages.banner.approved', { name: message.approved_by?.full_name ?? '—', date: text.dateTime(message.approved_at) }) }}</strong> {{ t('campaignMessages.banner.approvedNext') }}</span>
      </div>
      <p v-if="canApproveRight && message.status === 'ready' && message.can.approve_reason" class="rounded-2xl bg-dl-rejected/8 px-4 py-2.5 text-[12.5px] text-dl-rejected">{{ message.can.approve_reason }}</p>

      <div class="grid items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div class="flex min-w-0 flex-col gap-4">
          <template v-if="editable">
            <DlInput v-if="isSms" v-model="form.subject" :label="t('campaignMessages.fields.smsName')" :hint="t('campaignMessages.fields.smsNameHint')" :error="errors.subject" />
            <MailEditor v-else v-model="form.subject" single :label="t('campaignMessages.fields.subject')" :error="errors.subject" />
            <MailEditor v-model="form.body" :label="t('campaignMessages.fields.body')" :plain="isSms" :error="errors.body" :upload="isSms ? undefined : uploadImage" />
          </template>
          <MailFilesCard v-if="!isSms" :files="message.attachments ?? []" :can-edit="editable" :busy="busy === 'files'" @add="addFiles" @remove="removeFile" />
          <p v-if="isSms" class="rounded-2xl bg-dl-pending/15 px-4 py-3 text-[12.5px] text-dl-fg">{{ t('campaignMessages.sms.later') }}</p>
          <section v-if="message.history?.length" class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
            <h2 class="text-[15px] font-semibold">{{ t('campaignMessages.history.title') }}</h2>
            <dl class="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              <template v-for="(line, i) in message.history" :key="i">
                <dt class="text-dl-muted">{{ text.dateTime(line.at) }}</dt>
                <dd>
                  {{ t(`campaignMessages.history.${line.event === 'created' && line.template ? 'createdFrom' : line.event}`, { name: line.by ?? '—', template: line.template ?? '' }) }}
                  <span v-if="line.reason" class="text-dl-muted"> : « {{ line.reason }} »</span>
                </dd>
              </template>
            </dl>
          </section>
          <DlButton v-if="canWrite" variant="ghost" icon="tabler-trash" class="self-start text-dl-rejected" :loading="busy === 'delete'" @click="remove">{{ t('common.actions.delete') }}</DlButton>
        </div>
        <MailPreview :channel="message.channel" :subject="form.subject" :body="form.body" :campaign-id="message.campaign?.id" :files="message.attachments?.length" />
      </div>
    </template>

    <DlSheet v-model:open="returning" size="lg" :title="t('campaignMessages.return.title', { name: message?.created_by?.full_name ?? '' })" :description="t('campaignMessages.return.description')">
      <form id="message-return" @submit.prevent="sendBack">
        <DlTextarea v-model="reason" :label="t('campaignMessages.return.reason')" :rows="5" :error="errors.reason" />
      </form>
      <template #footer>
        <DlButton variant="ghost" @click="returning = false">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton type="submit" form="message-return" variant="dark" class="ms-auto" :disabled="!reason.trim()" :loading="busy === 'return'">{{ t('campaignMessages.return.send') }}</DlButton>
      </template>
    </DlSheet>
  </div>
</template>

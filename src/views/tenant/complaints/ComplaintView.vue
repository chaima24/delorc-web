<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchComplaint, moveComplaint, writeComplaint, type Complaint } from '@/api/tenant/complaints'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import TicketComposer from '@/views/shared/tickets/TicketComposer.vue'
import TicketConversation from '@/views/shared/tickets/TicketConversation.vue'
import TicketSteps from '@/views/shared/tickets/TicketSteps.vue'
import { useTicketText } from '@/views/shared/tickets/ticketDisplay'
import { COMPLAINT_FILE_TYPES, COMPLAINT_MAX_BYTES, COMPLAINT_TONE, useComplaintText } from './complaintDisplay'

// A complaint: the conversation between its author and the handlers. A handler takes it, marks it résolue or closes
// it; the author closes a résolue complaint or reopens it. Mockup: complaints-mockups/Complaints.html frames 2, 4, 5.
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const text = useComplaintText()
const time = useTicketText()

const complaint = ref<Complaint | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    complaint.value = await fetchComplaint(Number(props.id))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { complaint.value = null; load() }, { immediate: true })
onMountedAndFocus(() => { if (complaint.value) load() })
const can = computed(() => complaint.value?.can)
// The author sees « Mes réclamations », a handler « À traiter ».
const isAuthor = computed(() => !!complaint.value?.mine)

const composer = ref<InstanceType<typeof TicketComposer> | null>(null)
const writing = ref(false)
const writeError = ref('')
async function write(body: string, files: File[]) {
  if (!complaint.value) return
  writing.value = true
  writeError.value = ''
  try {
    await writeComplaint(complaint.value.id, body, files)
    composer.value?.clear()
    await load()
  }
  catch (error) {
    const fields = fieldErrors(error)
    writeError.value = fields.body ?? Object.values(fields)[0] ?? ''
    if (!writeError.value) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    writing.value = false
  }
}

const moving = ref(false)
async function move(action: 'take' | 'resolve' | 'close' | 'reopen') {
  if (action === 'close' || action === 'reopen') {
    const ok = await confirm({ title: t(`complaints.page.${action}Title`, { number: complaint.value!.number }), text: t(`complaints.page.${action}Text`), confirmButtonText: t(`complaints.page.${action}`) })
    if (!ok) return
  }
  moving.value = true
  try {
    await moveComplaint(complaint.value!.id, action)
    await load()
    toast.success(t(`complaints.page.${action}Done`))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    moving.value = false
  }
}
</script>

<template>
  <DlEmptyState v-if="failed" icon="tabler-message-report" :title="t('complaints.page.notFound')" />
  <DlSkeleton v-else-if="!complaint" class="h-96 rounded-3xl" />
  <div v-else class="flex w-full flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <RouterLink :to="{ name: isAuthor ? 'tenant-complaints' : 'tenant-complaints-inbox' }" class="text-sm text-dl-muted no-underline hover:underline">
        {{ t('nav.workspaces.complaints') }}
      </RouterLink>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ complaint.number }} · {{ complaint.title }}</h1>
        <DlBadge :tone="COMPLAINT_TONE[complaint.status]" dot>{{ text.status(complaint.status) }}</DlBadge>
        <span class="ms-auto flex flex-wrap gap-2">
          <DlButton v-if="can?.take" variant="outline" :loading="moving" @click="move('take')">{{ t('complaints.page.take') }}</DlButton>
          <DlButton v-if="can?.close && complaint.status !== 'resolved'" variant="outline" :loading="moving" @click="move('close')">{{ t('complaints.page.close') }}</DlButton>
          <DlButton v-if="can?.resolve" variant="primary" :loading="moving" @click="move('resolve')">{{ t('complaints.page.resolve') }}</DlButton>
          <DlButton v-if="can?.reopen && complaint.status === 'closed'" variant="outline" :loading="moving" @click="move('reopen')">{{ t('complaints.page.reopen') }}</DlButton>
        </span>
      </div>
    </div>
    <TicketSteps :status="complaint.status" prefix="complaints" />

    <div v-if="complaint.status === 'resolved' && can?.reopen" class="flex flex-wrap items-center gap-2.5 rounded-2xl bg-dl-signal-soft px-4 py-3 text-sm">
      <span class="flex-1">{{ t('complaints.page.resolvedAsk') }}</span>
      <DlButton size="sm" variant="outline" :loading="moving" @click="move('reopen')">{{ t('complaints.page.notFixed') }}</DlButton>
      <DlButton size="sm" variant="primary" :loading="moving" @click="move('close')">{{ t('complaints.page.fixed') }}</DlButton>
    </div>
    <div v-else-if="complaint.status === 'resolved' && can?.close" class="flex flex-wrap items-center gap-2.5 rounded-2xl bg-dl-mist px-4 py-3 text-sm">
      <span class="flex-1">{{ t('complaints.page.waitingAuthor') }}</span>
      <DlButton size="sm" variant="outline" :loading="moving" @click="move('close')">{{ t('complaints.page.close') }}</DlButton>
    </div>

    <div class="flex flex-wrap items-start gap-4">
      <section class="flex min-w-0 flex-[999_1_520px] flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('tickets.page.conversation')">
        <h2 class="text-[15px] font-semibold">{{ t('tickets.page.conversation') }}</h2>
        <TicketConversation :messages="complaint.messages ?? []" :mine="isAuthor ? 'author' : 'handler'" prefix="complaints" />
        <TicketComposer
          v-if="can?.write"
          ref="composer"
          :saving="writing"
          :error="writeError"
          :accept="COMPLAINT_FILE_TYPES"
          :max-bytes="COMPLAINT_MAX_BYTES"
          prefix="complaints"
          @send="write"
        />
      </section>
      <section class="flex flex-[1_1_320px] flex-col gap-3 rounded-3xl bg-dl-paper p-4 text-sm md:p-5" :aria-label="t('complaints.page.details')">
        <h2 class="text-[15px] font-semibold">{{ t('complaints.page.details') }}</h2>
        <dl class="grid grid-cols-[minmax(0,150px)_1fr] gap-x-3.5 gap-y-2">
          <dt class="text-[13px] text-dl-muted">{{ t('complaints.fields.category') }}</dt><dd>{{ complaint.category.name }}</dd>
          <dt class="text-[13px] text-dl-muted">{{ t('complaints.fields.urgency') }}</dt>
          <dd><DlBadge v-if="complaint.urgency === 'urgent'" size="sm" tone="danger">{{ t('complaints.urgency.urgent') }}</DlBadge><span v-else>{{ t('complaints.urgency.normal') }}</span></dd>
          <dt class="text-[13px] text-dl-muted">{{ t('complaints.fields.author') }}</dt>
          <dd :class="!complaint.user && 'italic text-dl-muted'">{{ text.author(complaint.user) }}<span v-if="complaint.anonymous && complaint.user" class="text-xs text-dl-muted"> · {{ t('complaints.page.sentAnonymously') }}</span></dd>
          <template v-if="complaint.concerned_user"><dt class="text-[13px] text-dl-muted">{{ t('complaints.fields.concerned') }}</dt><dd>{{ complaint.concerned_user.name }}</dd></template>
          <template v-if="complaint.taken_by"><dt class="text-[13px] text-dl-muted">{{ t('complaints.page.takenBy') }}</dt><dd>{{ complaint.taken_by.name }}</dd></template>
          <dt class="text-[13px] text-dl-muted">{{ t('complaints.fields.sentOn') }}</dt><dd>{{ time.time(complaint.created_at) }}</dd>
        </dl>
      </section>
    </div>
  </div>
</template>

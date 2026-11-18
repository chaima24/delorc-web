<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { fetchOnlineLink, sendOnlineLink, type LabEvent, type OnlineLink } from '@/api/tenant/events'
import DlButton from '@/components/DlButton.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'

// The « Lien en ligne » card above the invited (docs/api/event-online-link.md, mockup frames 1, 2 and 5): five figures,
// « Envoyer le lien » for the organiser or marketing (to those not sent yet), the window and the reminder. The page
// reads the rows from `loaded` to show each invited's link state; `resend` sends one row again.
const props = defineProps<{ event: LabEvent }>()
const emit = defineEmits<{ loaded: [link: OnlineLink] }>()
const { t, n, d } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

const link = ref<OnlineLink | null>(null)
async function load() {
  try {
    link.value = await fetchOnlineLink(props.event.id)
    emit('loaded', link.value)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
watch(() => props.event.id, load, { immediate: true })

const time = (value: string) => d(new Date(value), { hour: '2-digit', minute: '2-digit' })
const day = (value: string) => d(new Date(value), { day: 'numeric', month: 'short' })
const tiles = computed(() => {
  const c = link.value?.counts
  if (!c) return []
  return [
    { value: n(c.invited), label: t('events.link.tiles.invited') },
    { value: n(c.sent), label: c.reminded ? t('events.link.tiles.sentReminded', { count: n(c.reminded) }) : t('events.link.tiles.sent') },
    { value: n(c.not_sent), label: t('events.link.tiles.notSent') },
    { value: n(c.cannot), label: t('events.link.tiles.cannot') },
    { value: n(c.clicked), label: t('events.link.tiles.clicked', { percent: c.sent ? Math.round((c.clicked / c.sent) * 100) : 0 }) },
  ]
})
const buttonLabel = computed(() => {
  const count = n(link.value?.counts.not_sent ?? 0)
  return link.value?.last_sent ? t('events.link.sendNew', { count }) : t('events.link.send', { count })
})
const note = computed(() => {
  const l = link.value
  if (!l) return ''
  const window = t('events.link.window', { from: time(l.window.opens_at), to: time(l.window.closes_at) })
  return l.reminder_at ? `${window} ${t('events.link.reminder', { time: time(l.reminder_at) })}` : window
})

const sending = ref(false)
async function send(hcpIds?: number[]) {
  const l = link.value
  if (!l) return
  const count = hcpIds?.length ?? l.counts.not_sent
  if (!hcpIds) {
    const left = l.rows.filter(row => row.state === 'cannot').map(row => `${row.name} (${t(`events.link.why.${row.why}`)})`)
    const lines = [t('events.link.confirmText', { name: props.event.name })]
    if (left.length) lines.push(t('events.link.confirmCannot', { names: left.join(', ') }, left.length))
    if (l.counts.quota_left != null) lines.push(t('events.link.confirmQuota', { left: n(l.counts.quota_left), after: n(l.counts.quota_left - count) }))
    const ok = await confirm({ title: t('events.link.confirmTitle', { count: n(count) }, count), text: lines.join(' '), confirmButtonText: t('events.link.confirmButton', { count: n(count) }) })
    if (!ok) return
  }
  sending.value = true
  try {
    await sendOnlineLink(props.event.id, hcpIds)
    toast.success(t('events.link.queued', { count: n(count) }, count))
    await load()
    // The emails leave through the queue: read again a moment later to show them sent.
    setTimeout(load, 3000)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    sending.value = false
  }
}
defineExpose({ resend: (hcpId: number) => send([hcpId]), reload: load })
</script>

<template>
  <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
    <DlSkeleton v-if="!link" class="h-28 rounded-2xl" />
    <template v-else>
      <div class="flex flex-wrap items-center gap-2.5">
        <h2 class="text-[15px] font-semibold">{{ t('events.link.title') }}</h2>
        <span class="text-xs text-dl-muted">{{ link.last_sent
          ? t('events.link.lastSent', { date: day(link.last_sent.at), time: time(link.last_sent.at), name: link.last_sent.by ?? '—' })
          : t('events.link.neverSent') }}</span>
        <DlButton v-if="link.can_send && link.counts.not_sent" class="ms-auto" size="sm" icon="tabler-mail" :variant="link.last_sent ? 'outline' : 'primary'" :loading="sending" @click="send()">
          {{ buttonLabel }}
        </DlButton>
      </div>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div v-for="tile in tiles" :key="tile.label" class="flex flex-col gap-1 rounded-2xl bg-dl-mist p-3">
          <strong class="font-display text-[20px] leading-none">{{ tile.value }}</strong>
          <span class="text-xs text-dl-muted">{{ tile.label }}</span>
        </div>
      </div>
      <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('events.link.hint') }} {{ note }}</p>
    </template>
  </section>
</template>

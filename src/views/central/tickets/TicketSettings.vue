<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { ticketsApi, type TicketListItem, type TicketListKind, type TicketSettings } from '@/api/central/tickets'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

// Central › Tickets › Settings: the categories and priorities (with their hours), the same for every lab, in French,
// English and Arabic; the support address and the two delays. A used item is turned off, never deleted. Mockup frame 8.
const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const canEdit = computed(() => auth.can('tickets.settings'))

const KINDS: TicketListKind[] = ['ticket-categories', 'ticket-priorities']
const lists = ref<Record<TicketListKind, TicketListItem[]> | null>(null)
async function loadLists() {
  const [categories, priorities] = await Promise.all(KINDS.map(kind => ticketsApi.items(kind)))
  lists.value = { 'ticket-categories': categories!, 'ticket-priorities': priorities! }
}

// One item form open at a time: a new item of a list, or the item being edited.
interface Draft { kind: TicketListKind; id: number | null; fr: string; en: string; ar: string; hours: string; errors: Record<string, string> }
const draft = ref<Draft | null>(null)
const openAdd = (kind: TicketListKind) => { draft.value = { kind, id: null, fr: '', en: '', ar: '', hours: '', errors: {} } }
const openEdit = (kind: TicketListKind, item: TicketListItem) => {
  draft.value = { kind, id: item.id, fr: item.names.fr, en: item.names.en ?? '', ar: item.names.ar ?? '', hours: String(item.hours ?? ''), errors: {} }
}

async function run(action: () => Promise<unknown>, done = t('central.tickets.saved')) {
  try {
    await action()
    await loadLists()
    toast.success(done)
    return true
  }
  catch (error) {
    const fields = fieldErrors(error)
    if (draft.value && Object.keys(fields).length) draft.value.errors = fields
    else toast.error(errorMessage(error) ?? t('errors.network'))
    return false
  }
}
async function saveDraft() {
  const row = draft.value
  if (!row) return
  const payload = {
    names: { fr: row.fr, en: row.en || null, ar: row.ar || null },
    ...(row.kind === 'ticket-priorities' ? { hours: Number(row.hours) || undefined } : {}),
  }
  const ok = await run(() => (row.id ? ticketsApi.updateItem(row.kind, row.id, payload) : ticketsApi.addItem(row.kind, payload)))
  if (ok) draft.value = null
}
const move = (kind: TicketListKind, item: TicketListItem, by: number) => run(() => ticketsApi.updateItem(kind, item.id, { sort: item.sort + by }))
const toggle = (kind: TicketListKind, item: TicketListItem, value: boolean) => run(() => ticketsApi.updateItem(kind, item.id, { is_active: value }))
async function remove(kind: TicketListKind, item: TicketListItem) {
  const ok = await confirm({ title: t('central.tickets.settings.deleteTitle', { name: item.name }), text: t('central.tickets.settings.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (ok) await run(() => ticketsApi.deleteItem(kind, item.id), t('central.tickets.settings.deleted'))
}

// The support address and the delays, edited in place.
const settings = ref<TicketSettings | null>(null)
const editing = ref(false)
const form = ref({ support_email: '', close_after_days: '', reopen_days: '' })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function startEdit(value: boolean) {
  editing.value = value
  if (value && settings.value) {
    form.value = { support_email: settings.value.support_email ?? '', close_after_days: String(settings.value.close_after_days), reopen_days: String(settings.value.reopen_days) }
    errors.value = {}
  }
}
async function saveSettings() {
  saving.value = true
  errors.value = {}
  try {
    settings.value = await ticketsApi.saveSettings({
      support_email: form.value.support_email || null,
      close_after_days: Number(form.value.close_after_days),
      reopen_days: Number(form.value.reopen_days),
    })
    editing.value = false
    toast.success(t('central.tickets.saved'))
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('errors.network'))
  }
  finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadLists()
  settings.value = await ticketsApi.settings()
})
</script>

<template>
  <DlSkeleton v-if="!lists || !settings" class="h-80 rounded-3xl" />
  <div v-else class="grid items-start gap-4 lg:grid-cols-2">
    <section v-for="kind in KINDS" :key="kind" class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t(`central.tickets.settings.${kind}`)">
      <header class="flex items-center gap-2">
        <h2 class="flex-1 text-[15px] font-semibold">{{ t(`central.tickets.settings.${kind}`) }}</h2>
        <DlButton v-if="canEdit" size="sm" variant="outline" icon="tabler-plus" @click="openAdd(kind)">{{ t('central.tickets.settings.add') }}</DlButton>
      </header>
      <p class="text-xs text-dl-muted">{{ t(`central.tickets.settings.${kind}Hint`) }}</p>
      <ul class="flex flex-col">
        <li v-for="(item, i) in lists[kind]" :key="item.id" class="flex items-center gap-2 border-b border-dl-line-soft py-1.5 text-[13.5px] last:border-b-0">
          <span v-if="canEdit" class="flex flex-col">
            <DlIconButton icon="tabler-chevron-up" variant="ghost" :size="22" :label="t('central.tickets.settings.up', { name: item.name })" :disabled="i === 0" @click="move(kind, item, -1)" />
            <DlIconButton icon="tabler-chevron-down" variant="ghost" :size="22" :label="t('central.tickets.settings.down', { name: item.name })" :disabled="i === lists[kind].length - 1" @click="move(kind, item, 1)" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col" :class="!item.is_active && 'text-dl-muted'">
            <span>{{ item.names.fr }}<span v-if="item.hours" class="text-dl-muted"> · {{ t('central.tickets.settings.hours', { count: item.hours }) }}</span></span>
            <span class="truncate text-xs text-dl-muted">{{ [item.names.en, item.names.ar].filter(Boolean).join(' · ') }}</span>
          </span>
          <span v-if="item.tickets_count" class="whitespace-nowrap text-xs text-dl-muted">{{ t('central.tickets.settings.used', { count: item.tickets_count }, item.tickets_count) }}</span>
          <DlIconButton v-if="canEdit" icon="tabler-pencil" variant="ghost" :size="28" :label="t('central.tickets.settings.edit', { name: item.name })" @click="openEdit(kind, item)" />
          <DlIconButton v-if="canEdit && !item.tickets_count" icon="tabler-trash" variant="ghost" :size="28" :label="t('central.tickets.settings.delete', { name: item.name })" @click="remove(kind, item)" />
          <DlSwitch :model-value="item.is_active" :label="''" :aria-label="t('central.tickets.settings.active', { name: item.name })" :disabled="!canEdit" @update:model-value="value => toggle(kind, item, value)" />
        </li>
      </ul>
      <form v-if="draft && draft.kind === kind" class="flex flex-col gap-2.5 rounded-2xl border-2 border-dl-fg p-3" @submit.prevent="saveDraft">
        <div class="grid gap-2.5 sm:grid-cols-2">
          <DlInput v-model="draft.fr" :label="t('central.tickets.settings.nameFr')" :error="draft.errors['names.fr']" />
          <DlInput v-model="draft.en" :label="t('central.tickets.settings.nameEn')" :error="draft.errors['names.en']" />
          <DlInput v-model="draft.ar" :label="t('central.tickets.settings.nameAr')" dir="rtl" :error="draft.errors['names.ar']" />
          <DlInput v-if="kind === 'ticket-priorities'" v-model="draft.hours" type="number" :label="t('central.tickets.settings.hoursField')" :error="draft.errors.hours" />
        </div>
        <div class="flex justify-end gap-2">
          <DlButton size="sm" variant="ghost" @click="draft = null">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" size="sm" variant="primary">{{ draft.id ? t('common.actions.save') : t('central.tickets.settings.add') }}</DlButton>
        </div>
      </form>
    </section>

    <div class="rounded-3xl bg-dl-paper p-4 md:p-5 lg:col-span-2">
      <DlRecordSection :editing="editing" :title="t('central.tickets.settings.emailAndDelays')" icon="tabler-mail" :can-edit="canEdit" :saving="saving" @update:editing="startEdit" @save="saveSettings">
        <dl class="grid grid-cols-[minmax(0,220px)_1fr] gap-x-3.5 gap-y-2 text-sm">
          <dt class="text-[13px] text-dl-muted">{{ t('central.tickets.settings.supportEmail') }}</dt><dd>{{ settings.support_email || t('central.tickets.settings.noEmail') }}</dd>
          <dt class="text-[13px] text-dl-muted">{{ t('central.tickets.settings.closeAfter') }}</dt><dd>{{ t('central.settings.days', { count: settings.close_after_days }, settings.close_after_days) }}</dd>
          <dt class="text-[13px] text-dl-muted">{{ t('central.tickets.settings.reopenFor') }}</dt><dd>{{ t('central.settings.days', { count: settings.reopen_days }, settings.reopen_days) }}</dd>
        </dl>
        <template #edit>
          <div class="grid gap-3 md:grid-cols-3">
            <DlInput v-model="form.support_email" type="email" :label="t('central.tickets.settings.supportEmail')" :hint="t('central.tickets.settings.supportEmailHint')" :error="errors.support_email" />
            <DlInput v-model="form.close_after_days" type="number" :label="t('central.tickets.settings.closeAfterField')" :error="errors.close_after_days" />
            <DlInput v-model="form.reopen_days" type="number" :label="t('central.tickets.settings.reopenForField')" :error="errors.reopen_days" />
          </div>
        </template>
      </DlRecordSection>
    </div>
  </div>
</template>

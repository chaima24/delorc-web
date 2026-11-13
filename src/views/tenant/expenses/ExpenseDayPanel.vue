<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { approveExpenseDay, deleteExpenseDay, fetchExpenseDay, refuseExpenseDay, type ExpenseDay } from '@/api/tenant/expenses'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlMenu from '@/components/DlMenu.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import ExpenseAmountLines from './ExpenseAmountLines.vue'
import { STATUS_TONE, useExpenseText } from './expenseDisplay'

// One expense day: trips with their zone, stay, other costs with receipts, how the amount is computed.
// Approve or refuse (reason required) here. Mockup: docs/design/team-mockups/Expenses.html (frames 3–4)
const props = defineProps<{ dayId: number }>()
const emit = defineEmits<{ changed: []; deleted: []; edit: [day: ExpenseDay] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, d } = useI18n()
const text = useExpenseText()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const canDelete = (resource: string) => auth.can(`${resource}.delete`)
const canShow = (resource: string) => auth.can(`${resource}.show`)

const day = ref<ExpenseDay | null>(null)
const refusing = ref(false)
const reason = ref('')
const reasonError = ref('')
const busy = ref(false)

async function load() {
  day.value = null
  refusing.value = false
  reason.value = ''
  try {
    day.value = await fetchExpenseDay(props.dayId)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
watch(() => props.dayId, load, { immediate: true })

async function approve() {
  if (!day.value) return
  busy.value = true
  try {
    day.value = await approveExpenseDay(day.value.id)
    toast.success(t('expenses.toast.approved'))
    emit('changed')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    busy.value = false
  }
}

async function refuse() {
  if (!day.value) return
  if (!reason.value.trim()) {
    reasonError.value = t('expenses.refuse.required')
    return
  }
  busy.value = true
  try {
    day.value = await refuseExpenseDay(day.value.id, reason.value.trim())
    refusing.value = false
    toast.success(t('expenses.toast.refused'))
    emit('changed')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    busy.value = false
  }
}

async function remove() {
  if (!day.value) return
  const ok = await confirm({ title: t('expenses.delete.title'), text: t('expenses.delete.text', { day: text.dayLong(day.value.date) }), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteExpenseDay(day.value.id)
    toast.success(t('studio.list.toast.deleted'))
    emit('deleted')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

const menuItems = computed(() => {
  if (!day.value?.can.edit) return []
  return [
    ...(canUpdate('expenses') ? [{ label: t('expenses.panel.edit'), icon: 'tabler-pencil', onSelect: () => emit('edit', day.value!) }] : []),
    ...(canDelete('expenses') ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: remove }] : []),
  ]
})
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="day ? text.dayLong(day.date) : t('expenses.title')">
    <template #badges>
      <span v-if="day" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-dl-muted">
        <DlBadge size="sm" :tone="STATUS_TONE[day.status]">{{ text.status(day.status) }}</DlBadge>
        {{ day.user.full_name }}<template v-if="day.created_at"> · {{ t('expenses.panel.sent', { date: d(new Date(day.created_at), { day: 'numeric', month: 'short' }) }) }}</template>
      </span>
    </template>
    <template #actions>
      <DlMenu v-if="menuItems.length" :label="t('fieldSetup.menu.label')" :items="menuItems" />
    </template>

    <div v-if="!day" class="flex flex-col gap-3"><DlSkeleton v-for="i in 4" :key="i" class="h-20 rounded-2xl" /></div>
    <div v-else class="flex flex-col gap-3">
      <p v-if="day.status === 'rejected' && day.reason" class="rounded-xl bg-dl-rejected/7 px-3 py-2 text-[12.5px] text-dl-rejected">
        {{ t('expenses.panel.refusedBy', { name: day.treated_by?.full_name ?? '—' }) }} “{{ day.reason }}”
      </p>
      <p v-else-if="day.status === 'approved'" class="rounded-xl bg-dl-signal-soft px-3 py-2 text-[12.5px] text-dl-fg">
        {{ t('expenses.panel.approvedBy', { name: day.treated_by?.full_name ?? '—' }) }}
      </p>

      <section class="rounded-2xl border border-dl-line">
        <header class="flex items-center gap-2 px-3.5 pb-1.5 pt-3">
          <h3 class="flex-1 text-sm font-semibold">{{ t('expenses.panel.trips') }}</h3>
          <span class="text-xs text-dl-muted">{{ t('expenses.km', { km: text.km(day.amounts.km_in.typed + day.amounts.km_out.typed) }) }}</span>
        </header>
        <p v-if="!day.trips.length" class="px-3.5 pb-3 text-[13px] text-dl-muted">{{ t('expenses.panel.noTrips') }}</p>
        <div v-for="trip in day.trips" :key="trip.id" class="grid grid-cols-[1fr_auto_auto] items-center gap-2.5 border-t border-dl-line-soft px-3.5 py-2 text-[13px]">
          <span class="min-w-0">
            {{ trip.departure_commune?.name }} <span class="rtl:-scale-x-100 inline-block">→</span> {{ trip.arrival_commune?.name }}
            <small class="block text-xs text-dl-muted">{{ trip.expense_type?.name }}</small>
          </span>
          <span class="rounded-full px-2 py-0.5 text-[11.5px] font-bold" :class="trip.zone === 'out' ? 'bg-dl-teal/12 text-dl-teal' : 'bg-dl-cobalt/10 text-dl-cobalt'">{{ t(`expenses.zone.${trip.zone}`) }}</span>
          <span class="tabular-nums">{{ t('expenses.km', { km: text.km(trip.km) }) }}</span>
        </div>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1 text-sm font-semibold">{{ t('expenses.panel.stay') }}</h3>
        <p class="text-[13px] text-dl-body">{{ t(`expenses.stay.${day.type}`) }} · {{ t('expenses.panel.meals', { n: day.meals }, day.meals) }}</p>
      </section>

      <section v-if="day.costs.length" class="rounded-2xl border border-dl-line">
        <h3 class="px-3.5 pb-1.5 pt-3 text-sm font-semibold">{{ t('expenses.panel.costs') }}</h3>
        <div v-for="cost in day.costs" :key="cost.id" class="grid grid-cols-[1fr_auto_auto] items-center gap-2.5 border-t border-dl-line-soft px-3.5 py-2 text-[13px]">
          <span class="min-w-0">{{ cost.expense_type?.name }}<small v-if="cost.description" class="block text-xs text-dl-muted">{{ cost.description }}</small></span>
          <a v-if="cost.receipt?.url" :href="cost.receipt.url" target="_blank" rel="noopener" class="inline-flex h-[30px] items-center gap-1.5 rounded-[9px] border border-dl-line px-2.5 text-[12.5px] font-semibold text-dl-fg no-underline">📎 {{ t('expenses.panel.receipt') }}</a>
          <span v-else />
          <span class="tabular-nums">{{ text.money(cost.price) }}</span>
        </div>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-2 text-sm font-semibold">{{ t('expenses.panel.computed') }}</h3>
        <ExpenseAmountLines :amounts="day.amounts" />
        <p v-if="day.setting" class="mt-2 text-xs text-dl-muted">
          {{ t('expenses.panel.setting', { name: text.setting(day.setting), date: text.day(day.date) }) }}
          · <RouterLink v-if="canShow('expense-settings')" :to="{ name: 'tenant-expense-settings' }" class="text-dl-cobalt">{{ t('expenses.panel.openSetting') }}</RouterLink>
        </p>
        <p v-if="day.status === 'approved'" class="mt-2 text-xs text-dl-muted">{{ t('expenses.panel.frozen') }}</p>
      </section>

      <section v-if="day.comment" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1 text-sm font-semibold">{{ t('expenses.panel.note') }}</h3>
        <p class="text-[13px] text-dl-body">{{ day.comment }}</p>
      </section>

      <div v-if="day.attachments.length" class="flex flex-wrap gap-2">
        <a v-for="(file, i) in day.attachments" :key="file.id" :href="file.url ?? undefined" target="_blank" rel="noopener" class="inline-flex h-[30px] items-center gap-1.5 rounded-[9px] border border-dl-line px-2.5 text-[12.5px] font-semibold text-dl-fg no-underline">📎 {{ t('expenses.panel.file', { n: i + 1 }) }}</a>
      </div>

      <label v-if="refusing" class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('expenses.refuse.label') }}</span>
        <textarea v-model="reason" rows="3" class="rounded-xl border border-dl-line bg-dl-paper px-3.5 py-2.5 text-sm outline-hidden focus:ring-2 focus:ring-dl-cobalt" @input="reasonError = ''" />
        <span v-if="reasonError" class="text-xs text-dl-rejected">{{ reasonError }}</span>
        <span v-else class="text-xs text-dl-muted">{{ t('expenses.refuse.hint', { name: day.user.full_name }) }}</span>
      </label>
    </div>

    <template v-if="day?.can.approve" #footer>
      <template v-if="refusing">
        <DlButton variant="ghost" @click="refusing = false">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton variant="danger" class="ms-auto" :loading="busy" @click="refuse">{{ t('expenses.refuse.confirm') }}</DlButton>
      </template>
      <template v-else>
        <DlButton variant="outline" icon="tabler-x" @click="refusing = true">{{ t('expenses.refuse.button') }}</DlButton>
        <DlButton variant="primary" icon="tabler-check" class="ms-auto" :loading="busy" @click="approve">{{ t('expenses.approve.one', { amount: text.money(day.amounts.total) }) }}</DlButton>
      </template>
    </template>
  </DlRecordPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchEventMaterials, fetchInvitable, fetchParticipant, saveParticipant, type EventInvite, type Invitable, type LabEvent } from '@/api/tenant/events'
import type { MaterialStock } from '@/api/tenant/materials'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlDateRangePicker from '@/components/DlDateRangePicker.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useEventText } from './eventDisplay'

// « Ma participation » (mockup frames 7 and 8): took part or not, hours, a rating, the real cost, a comment; the
// materials taken from one's own « event » stock; the professionals one invited, ticked present (from the start), and,
// when the lab has the feature, « pris en charge » with an amount. Saved in one call.
const props = defineProps<{ event: LabEvent }>()
const emit = defineEmits<{ saved: [] }>()
const { t, n } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const text = useEventText()
const sponsoring = computed(() => auth.hasFeature('events.sponsoring'))
const started = computed(() => new Date(props.event.start_at.replace(' ', 'T')) <= new Date())

const loading = ref(true)
const lines = ref<MaterialStock[]>([])
const form = ref({ attended: 'none', start_date: '', start_time: '', end_date: '', end_time: '', rating: 0, cost: '', comments: '' })
const invites = ref<EventInvite[]>([])
const taken = ref<Record<number, number>>({})
const errors = ref<Record<string, string>>({})
const saving = ref(false)

async function load() {
  if (!auth.user) return
  loading.value = true
  try {
    const [part, offered] = await Promise.all([fetchParticipant(props.event.id, auth.user.id), fetchEventMaterials(props.event.id)])
    form.value = {
      attended: part.attended == null ? 'none' : part.attended ? 'yes' : 'no',
      start_date: part.start_at.slice(0, 10), start_time: part.start_at.slice(11, 16), end_date: part.end_at.slice(0, 10), end_time: part.end_at.slice(11, 16),
      rating: part.rating ?? 0, cost: part.cost == null ? '' : String(part.cost), comments: part.comments ?? '',
    }
    invites.value = part.invites ?? []
    taken.value = Object.fromEntries((part.materials ?? []).map(line => [line.material_stock_id, line.quantity]))
    lines.value = offered
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
watch(() => props.event.id, load, { immediate: true })

const attendedItems = computed(() => [
  { value: 'yes', label: t('events.part.yes') },
  { value: 'no', label: t('events.part.no') },
  ...(form.value.attended === 'none' ? [{ value: 'none', label: t('events.part.notYet') }] : []),
])
const step = (line: MaterialStock, delta: number) => {
  const now = taken.value[line.id] ?? 0
  taken.value = { ...taken.value, [line.id]: Math.max(0, now + delta) }
}

// Inviting: one's own professionals, searched on the server.
const search = ref('')
const found = ref<Invitable[]>([])
const searchError = ref('')
const picked = ref<string | number | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, value => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      found.value = await fetchInvitable(props.event.id, value)
      searchError.value = ''
    }
    catch (error) {
      searchError.value = errorMessage(error) ?? t('studio.list.toast.failed')
    }
  }, 250)
}, { immediate: true })
const options = computed(() => found.value.filter(row => !invites.value.some(invite => invite.hcp.id === row.id)).map(row => ({
  value: row.id, label: row.name,
  hint: row.invited_by ? t('events.part.invitedBy', { name: row.invited_by }) : [row.speciality, row.commune].filter(Boolean).join(' · '),
})))
watch(picked, value => {
  const row = found.value.find(item => item.id === value)
  if (!row) return
  if (row.invited_by) toast.error(t('events.part.invitedBy', { name: row.invited_by }))
  else invites.value = [...invites.value, { hcp: { id: row.id, name: row.name, type: row.type, speciality: row.speciality, commune: row.commune }, present: false, sponsored: false, sponsored_amount: null }]
  picked.value = null
})
const setAmount = (invite: EventInvite, value: string) => { invite.sponsored_amount = value === '' ? null : Number(value.replace(/\s/g, '').replace(',', '.')) }
const present = computed(() => invites.value.filter(invite => invite.present).length)

async function save() {
  if (!auth.user) return
  errors.value = {}
  saving.value = true
  const f = form.value
  try {
    await saveParticipant(props.event.id, auth.user.id, {
      ...(started.value ? { attended: f.attended === 'none' ? null : f.attended === 'yes', rating: f.rating || null } : {}),
      start_at: f.start_date ? `${f.start_date} ${f.start_time || '00:00'}` : null,
      end_at: f.end_date ? `${f.end_date} ${f.end_time || '23:59'}` : null,
      cost: f.cost === '' ? null : Number(f.cost.replace(/\s/g, '').replace(',', '.')),
      comments: f.comments.trim() || null,
      hcps: invites.value.map(invite => ({
        hcp_id: invite.hcp.id, present: invite.present,
        ...(sponsoring.value ? { sponsored: !!invite.sponsored, sponsored_amount: invite.sponsored ? invite.sponsored_amount ?? null : null } : {}),
      })),
      materials: Object.entries(taken.value).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ material_stock_id: Number(id), quantity })),
    })
    toast.success(t('events.part.saved'))
    emit('saved')
    await load()
  }
  catch (error) {
    errors.value = fieldErrors(error)
    toast.error(Object.values(errors.value)[0] ?? errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="grid gap-4 lg:grid-cols-2"><DlSkeleton class="h-80 rounded-3xl" /><DlSkeleton class="h-80 rounded-3xl" /></div>
  <div v-else class="grid items-start gap-4 lg:grid-cols-[1fr_1.15fr]">
    <div class="flex flex-col gap-4">
      <section class="flex flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-5">
        <h2 class="text-[15px] font-semibold">{{ t('events.part.title') }}</h2>
        <div class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">{{ t('events.part.attended') }}</span>
          <DlSegmented v-model="form.attended" :label="t('events.part.attended')" :items="attendedItems" :disabled="!started" />
          <span v-if="!started" class="text-xs text-dl-muted">{{ t('events.part.fromStart') }}</span>
        </div>
        <DlDateRangePicker v-model:start="form.start_date" v-model:end="form.end_date" :label="t('events.part.hours')" :error="errors.start_at || errors.end_at" />
        <div class="grid grid-cols-2 gap-3">
          <DlInput v-model="form.start_time" type="time" :label="t('events.fields.startTime')" />
          <DlInput v-model="form.end_time" type="time" :label="t('events.fields.endTime')" />
        </div>
        <div class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">{{ t('events.part.rating') }}</span>
          <div class="flex gap-1" role="radiogroup" :aria-label="t('events.part.rating')">
            <button v-for="star in 5" :key="star" type="button" role="radio" :aria-checked="form.rating === star" :disabled="!started"
              :aria-label="t('events.part.stars', { count: star }, star)" class="text-2xl leading-none disabled:opacity-40"
              :class="star <= form.rating ? 'text-dl-pending' : 'text-dl-line'" @click="form.rating = form.rating === star ? 0 : star">★</button>
          </div>
        </div>
        <DlInput v-model="form.cost" inputmode="decimal" :label="t('events.part.cost')" :hint="t('events.part.costHint')" :error="errors.cost" />
        <DlTextarea v-model="form.comments" :label="t('events.part.comments')" :rows="3" :error="errors.comments" />
      </section>

      <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
        <header class="flex items-center gap-2"><h2 class="flex-1 text-[15px] font-semibold">{{ t('events.part.materials') }}</h2><span class="text-xs text-dl-muted">{{ t('events.part.materialsHint') }}</span></header>
        <p v-if="!lines.length" class="text-[13px] text-dl-muted">{{ t('events.part.noMaterials') }}</p>
        <div v-for="line in lines" :key="line.id" class="flex items-center gap-3 rounded-2xl bg-dl-mist p-3">
          <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-dl-paper"><DlIcon icon="tabler-gift" :size="18" /></span>
          <div class="min-w-0 flex-1">
            <strong class="text-sm">{{ line.materiel.name }}</strong>
            <span class="ms-1.5 rounded-full bg-dl-paper px-2 py-0.5 text-[11px]">{{ line.campaign.name }}</span>
            <span class="block text-xs text-dl-muted">{{ t('events.part.left', { count: n(line.left) }) }}</span>
          </div>
          <div class="flex items-center overflow-hidden rounded-xl border border-dl-line bg-dl-paper">
            <button type="button" class="h-9 w-9 font-bold" :aria-label="t('events.part.less')" @click="step(line, -1)">−</button>
            <strong class="min-w-9 text-center tabular-nums">{{ taken[line.id] ?? 0 }}</strong>
            <button type="button" class="h-9 w-9 font-bold" :aria-label="t('events.part.more')" @click="step(line, 1)">+</button>
          </div>
        </div>
      </section>
      <DlButton variant="dark" class="self-end" :loading="saving" @click="save">{{ t('events.part.save') }}</DlButton>
    </div>

    <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
      <header class="flex items-center gap-2">
        <h2 class="flex-1 text-[15px] font-semibold">{{ t('events.part.invites') }}</h2>
        <span class="rounded-full bg-dl-mist px-2.5 py-1 text-xs">{{ t('events.part.invitedCount', { invited: n(invites.length), present: n(present) }) }}</span>
      </header>
      <p v-if="searchError" class="text-[13px] text-dl-rejected">{{ searchError }}</p>
      <DlCombobox v-else v-model="picked" v-model:search="search" :label="t('events.part.invite')" :placeholder="t('events.part.invitePlaceholder')" :options="options" hide-label />
      <p v-if="!invites.length" class="py-3 text-[13px] text-dl-muted">{{ t('events.part.noInvites') }}</p>
      <table v-else class="w-full text-sm">
        <thead class="text-start text-xs text-dl-muted">
          <tr>
            <th class="py-1.5 text-start font-medium">{{ t('events.part.professional') }}</th>
            <th class="py-1.5 text-center font-medium">{{ t('events.part.present') }}</th>
            <template v-if="sponsoring">
              <th class="py-1.5 text-center font-medium">{{ t('events.part.sponsored') }}</th>
              <th class="py-1.5 text-end font-medium">{{ t('events.part.amount') }}</th>
            </template>
            <th class="w-8" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(invite, i) in invites" :key="invite.hcp.id" class="border-t border-dl-line-soft">
            <td class="py-2">
              <strong class="block">{{ invite.hcp.name }}</strong>
              <span class="text-xs text-dl-muted">{{ [invite.hcp.speciality, invite.hcp.commune].filter(Boolean).join(' · ') }}</span>
              <span v-if="errors[`hcps.${i}.hcp_id`]" class="block text-xs text-dl-rejected">{{ errors[`hcps.${i}.hcp_id`] }}</span>
            </td>
            <td class="text-center"><input v-model="invite.present" type="checkbox" class="h-4 w-4 accent-dl-ink" :disabled="!started" :aria-label="t('events.part.present')"></td>
            <template v-if="sponsoring">
              <td class="text-center"><input v-model="invite.sponsored" type="checkbox" class="h-4 w-4 accent-dl-ink" :aria-label="t('events.part.sponsored')"></td>
              <td class="w-32 py-1"><DlInput v-if="invite.sponsored" :model-value="invite.sponsored_amount == null ? '' : String(invite.sponsored_amount)" inputmode="decimal" @update:model-value="value => setAmount(invite, String(value ?? ''))" :label="t('events.part.amount')" hide-label /></td>
            </template>
            <td class="text-end"><button type="button" class="text-dl-muted hover:text-dl-fg" :aria-label="t('common.actions.delete')" @click="invites = invites.filter(row => row !== invite)"><DlIcon icon="tabler-x" :size="16" /></button></td>
          </tr>
        </tbody>
      </table>
      <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ started ? t('events.part.invitesHint') : t('events.part.invitesHintBefore') }} · {{ text.target(event.type) }}</p>
    </section>
  </div>
</template>

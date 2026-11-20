<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchAllBrands } from '@/api/tenant/brands'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  COMPETITIVE_LEVELS, deleteCompetitiveFile, deleteCompetitiveInformation, fetchCompetitiveForm, fetchCompetitiveInformation,
  processCompetitiveInformation, sendCompetitiveInformation, updateCompetitiveInformation, uploadCompetitiveFiles,
  type CompetitiveForm, type CompetitiveHistoryLine, type CompetitiveInformation, type CompetitiveLevel, type CompetitiveList,
  type CompetitivePayload, type CompetitiveText,
} from '@/api/tenant/competitive'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDatePicker from '@/components/DlDatePicker.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import CompetitiveProcessPanel from './CompetitiveProcessPanel.vue'
import { STATUS_TONE, today, useCompetitiveText } from './competitiveDisplay'

// A note's page: one card per part of the old form, edited in place while it is the author's draft; its files; its
// history. The author sends it; marketing marks it « traitée ». Mockup: competitive-mockups/CompetitiveInformation.html 3–8.
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const text = useCompetitiveText()

const note = ref<CompetitiveInformation | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    note.value = await fetchCompetitiveInformation(Number(props.id))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { note.value = null; load() }, { immediate: true })
const canEdit = computed(() => !!note.value?.can?.update)

// The form's lists (active items) and our brands, reloaded on open and when the tab comes back.
const lists = ref<CompetitiveForm | null>(null)
const brands = ref<{ value: number; label: string }[]>([])
onMountedAndFocus(async () => {
  lists.value = await fetchCompetitiveForm().catch(() => null) // marketing reads notes but doesn't write them
  brands.value = (await fetchAllBrands().catch(() => [])).map(brand => ({ value: brand.id, label: brand.name }))
})

type Level = 'interest_level' | 'urgency_level' | 'reliability_level'
type CardKey = 'note' | 'source' | 'promo' | 'hcp' | 'position' | 'needs'
interface Card { key: CardKey; icon: string; lists: CompetitiveList[]; texts: CompetitiveText[]; levels: Level[] }
// The old form's parts, as the mockup: which lists, texts and levels each card shows and saves.
const CARDS: Card[] = [
  { key: 'note', icon: 'tabler-file-search', lists: ['therapeutic'], texts: ['principal_indication'], levels: [] },
  { key: 'source', icon: 'tabler-ear', lists: ['source'], texts: [], levels: ['reliability_level'] },
  { key: 'promo', icon: 'tabler-speakerphone', lists: ['action_type', 'argument'], texts: ['key_message'], levels: [] },
  { key: 'hcp', icon: 'tabler-stethoscope', lists: [], texts: ['question_comparison'], levels: ['interest_level'] },
  { key: 'position', icon: 'tabler-chart-dots', lists: [], texts: ['competitor_force', 'competitor_weakness', 'differentiation_vs_our_offer'], levels: [] },
  { key: 'needs', icon: 'tabler-alert-triangle', lists: ['support'], texts: [], levels: ['urgency_level'] },
]
const TEXT_LABEL: Record<CompetitiveText, string> = {
  principal_indication: 'indication', key_message: 'keyMessage', question_comparison: 'questionComparison',
  competitor_force: 'force', competitor_weakness: 'weakness', differentiation_vs_our_offer: 'differentiation',
}
const LEVEL_LABEL: Record<Level, string> = { interest_level: 'interest', urgency_level: 'urgency', reliability_level: 'reliability' }

const NONE = 0
const NO_LEVEL = 'none'
const editing = ref<CardKey | null>(null)
const form = ref({
  seen_on: '', laboratory: '', product: '', brand_id: NONE as number | string | null,
  texts: {} as Partial<Record<CompetitiveText, string>>,
  levels: {} as Partial<Record<Level, string>>,
  picks: {} as Partial<Record<CompetitiveList, number[]>>,
  others: {} as Partial<Record<CompetitiveList, string>>,
})
const errors = ref<Record<string, string>>({})
const saving = ref(false)

function edit(card: CardKey | null) {
  const row = note.value
  if (!row) return
  const details = row.details
  form.value = {
    seen_on: row.seen_on, laboratory: row.laboratory, product: row.product, brand_id: row.brand?.id ?? NONE,
    texts: Object.fromEntries(CARDS.flatMap(c => c.texts).map(key => [key, row[key] ?? ''])),
    levels: Object.fromEntries(CARDS.flatMap(c => c.levels).map(key => [key, row[key] ?? NO_LEVEL])),
    picks: Object.fromEntries(CARDS.flatMap(c => c.lists).map(list => [list, (details?.[list] ?? []).flatMap(d => (d.competitive_type_id ? [d.competitive_type_id] : []))])),
    others: Object.fromEntries(CARDS.flatMap(c => c.lists).map(list => [list, details?.[list]?.find(d => !d.competitive_type_id)?.other_comment ?? ''])),
  }
  errors.value = {}
  editing.value = card
}

// A list's choices: the active items, plus the items the note already holds that were turned off since.
function items(list: CompetitiveList) {
  const active = (lists.value?.[list] ?? []).map(item => ({ value: item.id, label: item.content }))
  const held = (note.value?.details?.[list] ?? [])
    .filter(d => d.competitive_type_id && !active.some(item => item.value === d.competitive_type_id))
    .map(d => ({ value: d.competitive_type_id!, label: d.content ?? '', hint: t('competitive.fields.off') }))
  return [...active, ...held]
}
const levelItems = computed(() => [{ value: NO_LEVEL, label: '—' }, ...COMPETITIVE_LEVELS.map(level => ({ value: level, label: text.level(level) }))])
const brandOptions = computed(() => [{ value: NONE, label: t('competitive.fields.noBrand') }, ...brands.value])

function payload(card: Card): CompetitivePayload {
  const out: CompetitivePayload = {}
  if (card.key === 'note') {
    Object.assign(out, { seen_on: form.value.seen_on, laboratory: form.value.laboratory, product: form.value.product, brand_id: Number(form.value.brand_id) || null })
  }
  card.texts.forEach(key => { out[key] = form.value.texts[key] || null })
  card.levels.forEach(key => {
    const value = form.value.levels[key]
    out[key] = !value || value === NO_LEVEL ? null : (value as CompetitiveLevel)
  })
  if (card.lists.length) {
    out.detail_types = card.lists
    out.details = card.lists.flatMap(list => [
      ...(form.value.picks[list] ?? []).map(id => ({ type: list, competitive_type_id: id })),
      ...(form.value.others[list]?.trim() ? [{ type: list, other_comment: form.value.others[list]!.trim() }] : []),
    ])
  }
  return out
}

async function save(card: Card) {
  if (!note.value) return
  errors.value = {}
  saving.value = true
  try {
    note.value = await updateCompetitiveInformation(note.value.id, payload(card))
    editing.value = null
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    errors.value = fieldErrors(error)
    const detailError = Object.entries(errors.value).find(([key]) => key.startsWith('details'))?.[1]
    if (detailError) toast.error(detailError)
    else if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}

// What a card shows in reading mode.
const picked = (list: CompetitiveList) => (note.value?.details?.[list] ?? [])
  .map(d => (d.competitive_type_id ? d.content : t('competitive.fields.otherValue', { text: d.other_comment ?? '' })))
  .filter(Boolean) as string[]

// Files: photos and PDFs, only on the author's draft.
const uploading = ref(false)
async function addFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length || !note.value) return
  uploading.value = true
  try {
    await uploadCompetitiveFiles(note.value.id, files)
    await load()
  }
  catch (error) {
    const fields = fieldErrors(error)
    toast.error(Object.values(fields)[0] ?? errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    uploading.value = false
    input.value = ''
  }
}
async function dropFile(fileId: number) {
  if (!note.value) return
  await deleteCompetitiveFile(note.value.id, fileId)
  await load()
}
const size = (bytes: number) => (bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`)

async function remove() {
  if (!note.value) return
  const ok = await confirm({ title: t('competitive.page.deleteTitle', { number: note.value.number }), text: t('competitive.page.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteCompetitiveInformation(note.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-competitive-informations' })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

const moving = ref(false)
async function send() {
  if (!note.value) return
  const ok = await confirm({ title: t('competitive.page.sendTitle', { number: note.value.number }), text: t('competitive.page.sendText'), confirmButtonText: t('competitive.page.send'), icon: 'question' })
  if (!ok) return
  moving.value = true
  try {
    note.value = await sendCompetitiveInformation(note.value.id)
    editing.value = null
    toast.success(t('competitive.page.sent'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    moving.value = false
  }
}
const processing = ref(false)
const processError = ref('')
async function process(comment: string) {
  if (!note.value) return
  moving.value = true
  processError.value = ''
  try {
    note.value = await processCompetitiveInformation(note.value.id, comment.trim() || null)
    processing.value = false
    toast.success(t('competitive.page.processed'))
  }
  catch (error) {
    processError.value = fieldErrors(error).comment ?? ''
    if (!processError.value) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    moving.value = false
  }
}

const STEPS = ['draft', 'sent', 'processed'] as const
const reached = (step: (typeof STEPS)[number]) => STEPS.indexOf(note.value!.status) >= STEPS.indexOf(step)

function historyLine(line: CompetitiveHistoryLine): string {
  const join = (value: unknown) => (Array.isArray(value) ? value.join(', ') : '')
  if (line.event === 'created') return t('competitive.history.created')
  if (line.event === 'sent') return t('competitive.history.sent')
  if (line.event === 'processed') return line.comment ? t('competitive.history.processedWhy', { comment: line.comment }) : t('competitive.history.processed')
  if (line.event === 'files_changed') return line.added ? t('competitive.history.filesAdded', { names: join(line.added) }) : t('competitive.history.filesRemoved', { names: join(line.removed) })
  if (line.new && 'details' in line.new) return t('competitive.history.details', { before: join(line.old?.details) || '—', after: join(line.new.details) || '—' })
  return t('competitive.history.changed')
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('competitive.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-competitive-informations' }">{{ t('competitive.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!note">
      <DlSkeleton class="h-20 rounded-2xl" />
      <DlSkeleton class="h-64 rounded-3xl" />
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
            <RouterLink :to="{ name: 'tenant-competitive-informations' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('competitive.list.title') }}</RouterLink>
            <span aria-hidden="true">›</span><span>{{ note.number }}</span>
          </nav>
          <h1 class="flex flex-wrap items-center gap-3 font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">
            {{ note.number }} · {{ note.laboratory }} · {{ note.product }}
            <DlBadge size="sm" :tone="STATUS_TONE[note.status]" dot>{{ text.status(note.status) }}</DlBadge>
          </h1>
          <p class="text-[13px] text-dl-muted">{{ t('competitive.read.by', { name: note.user?.full_name ?? '', date: text.date(note.seen_on) }) }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <DlButton v-if="note.can?.delete" variant="outline" icon="tabler-trash" @click="remove">{{ t('common.actions.delete') }}</DlButton>
          <DlButton v-if="note.can?.send" variant="primary" icon="tabler-send" :loading="moving" @click="send">{{ t('competitive.page.send') }}</DlButton>
          <DlButton v-if="note.can?.process" variant="primary" icon="tabler-check" :loading="moving" @click="processing = true; processError = ''">{{ t('competitive.page.process') }}</DlButton>
        </div>
      </div>

      <ol class="flex flex-wrap items-center gap-1.5 text-[13px]" :aria-label="t('competitive.fields.status')">
        <template v-for="(step, i) in STEPS" :key="step">
          <li><DlBadge size="sm" :tone="reached(step) ? 'success' : 'neutral'" :class="note.status === step && 'ring-2 ring-dl-ink'">{{ text.status(step) }}</DlBadge></li>
          <li v-if="i < STEPS.length - 1" aria-hidden="true" class="text-dl-muted">→</li>
        </template>
      </ol>
      <p v-if="note.status === 'draft' && canEdit" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13.5px] text-dl-muted">{{ t('competitive.page.draftBanner') }}</p>
      <p v-else-if="note.status === 'sent' && !note.can?.process" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13.5px] text-dl-muted">{{ t('competitive.page.waiting') }}</p>
      <p v-else-if="note.status === 'processed'" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13.5px] text-dl-muted">
        {{ t('competitive.page.processedBanner', { name: note.processed_by?.full_name ?? '', date: text.date(note.processed_at) }) }}
        <template v-if="note.processed_comment"> — « {{ note.processed_comment }} »</template>
      </p>

      <div class="grid items-start gap-4 xl:grid-cols-2">
        <div v-for="card in CARDS" :key="card.key" class="rounded-3xl bg-dl-paper p-4 md:p-5">
          <DlRecordSection :editing="editing === card.key" @update:editing="(value: boolean) => edit(value ? card.key : null)" :title="t(`competitive.cards.${card.key}`)" :icon="card.icon" :can-edit="canEdit" :saving="saving" @save="save(card)" @cancel="edit(null)">
            <dl class="grid grid-cols-[170px_1fr] gap-x-3 gap-y-1.5">
              <template v-if="card.key === 'note'">
                <dt class="text-dl-muted">{{ t('competitive.fields.seenOn') }}</dt><dd>{{ text.date(note.seen_on) }}</dd>
                <dt class="text-dl-muted">{{ t('competitive.fields.laboratory') }}</dt><dd>{{ note.laboratory }}</dd>
                <dt class="text-dl-muted">{{ t('competitive.fields.product') }}</dt><dd>{{ note.product }}</dd>
                <dt class="text-dl-muted">{{ t('competitive.fields.brand') }}</dt><dd>{{ note.brand?.name ?? '—' }}</dd>
              </template>
              <template v-for="list in card.lists" :key="list">
                <dt class="text-dl-muted">{{ text.list(list) }}</dt>
                <dd class="flex flex-wrap gap-1">
                  <DlBadge v-for="label in picked(list)" :key="label" size="sm">{{ label }}</DlBadge>
                  <span v-if="!picked(list).length">—</span>
                </dd>
              </template>
              <template v-for="key in card.texts" :key="key">
                <dt class="text-dl-muted">{{ t(`competitive.fields.${TEXT_LABEL[key]}`) }}</dt><dd class="whitespace-pre-line">{{ note[key] || '—' }}</dd>
              </template>
              <template v-for="key in card.levels" :key="key">
                <dt class="text-dl-muted">{{ t(`competitive.fields.${LEVEL_LABEL[key]}`) }}</dt><dd>{{ text.level(note[key]) }}</dd>
              </template>
            </dl>
            <template #edit>
              <div v-if="card.key === 'note'" class="grid gap-3 md:grid-cols-2">
                <DlDatePicker v-model="form.seen_on" :label="t('competitive.fields.seenOn')" :max="today()" :error="errors.seen_on" />
                <DlSelect v-model="form.brand_id" :label="t('competitive.fields.brand')" :options="brandOptions" />
                <DlInput v-model="form.laboratory" :label="t('competitive.fields.laboratory')" :error="errors.laboratory" />
                <DlInput v-model="form.product" :label="t('competitive.fields.product')" :error="errors.product" />
              </div>
              <div v-for="list in card.lists" :key="list" class="flex flex-col gap-2">
                <CheckList
                  v-model="form.picks[list]!"
                  :legend="text.list(list)"
                  :selected-label="t('competitive.fields.chosen', { count: form.picks[list]?.length ?? 0 }, form.picks[list]?.length ?? 0)"
                  :search-label="t('competitive.fields.search')"
                  :items="items(list)"
                  :empty-text="t('competitive.fields.listEmpty')"
                />
                <DlInput v-model="form.others[list]" :label="t('competitive.fields.other')" :placeholder="t('competitive.fields.otherPlaceholder')" />
              </div>
              <div v-if="card.levels.length" class="grid gap-3">
                <div v-for="key in card.levels" :key="key" class="flex flex-col gap-1.5">
                  <span class="text-[13px] font-semibold">{{ t(`competitive.fields.${LEVEL_LABEL[key]}`) }}</span>
                  <DlSegmented v-model="form.levels[key]!" :label="t(`competitive.fields.${LEVEL_LABEL[key]}`)" :items="levelItems" block />
                </div>
              </div>
              <DlTextarea v-for="key in card.texts" :key="key" v-model="form.texts[key]!" :label="t(`competitive.fields.${TEXT_LABEL[key]}`)" :error="errors[key]" />
            </template>
          </DlRecordSection>
        </div>
      </div>

      <div class="grid items-start gap-4 xl:grid-cols-2">
        <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
          <h2 class="text-[15px] font-semibold">{{ t('competitive.fields.files') }}</h2>
          <ul v-if="note.files?.length" class="flex flex-col gap-2">
            <li v-for="file in note.files" :key="file.id" class="flex items-center gap-3 rounded-xl border border-dl-line px-3 py-2 text-[13px]">
              <span class="min-w-0 flex-1">
                <a v-if="file.url" :href="file.url" target="_blank" rel="noopener" class="font-semibold text-dl-cobalt no-underline hover:underline">{{ file.name }} ↗</a>
                <strong v-else>{{ file.name }}</strong>
                <span class="block text-xs text-dl-muted">{{ size(file.size) }}</span>
              </span>
              <DlButton v-if="canEdit" size="sm" variant="ghost" icon="tabler-trash" @click="dropFile(file.id)">{{ t('common.actions.delete') }}</DlButton>
            </li>
          </ul>
          <p v-else class="text-[13px] text-dl-muted">{{ t('competitive.page.noFiles') }}</p>
          <template v-if="canEdit">
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" :disabled="uploading" class="text-[13px] file:me-3 file:rounded-lg file:border file:border-dl-line file:bg-dl-paper file:px-3 file:py-1.5" :aria-label="t('competitive.fields.files')" @change="addFiles">
            <p class="text-xs text-dl-muted">{{ t('competitive.page.filesHint') }}</p>
          </template>
        </section>

        <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
          <h2 class="text-[15px] font-semibold">{{ t('competitive.page.history') }}</h2>
          <ul class="flex flex-col gap-1.5 text-[13px]">
            <li v-for="(line, i) in note.history" :key="i" class="flex flex-wrap gap-x-2">
              <span class="tabular-nums text-dl-muted">{{ text.date(line.at) }}</span>
              <span v-if="line.by" class="font-semibold">{{ line.by }}</span>
              <span>{{ historyLine(line) }}</span>
            </li>
          </ul>
        </section>
      </div>
      <CompetitiveProcessPanel v-if="processing" v-model:open="processing" :number="note.number" :saving="moving" :error="processError" @confirm="process" />
    </template>
  </div>
</template>

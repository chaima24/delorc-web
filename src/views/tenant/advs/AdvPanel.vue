<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { deleteAdv, deleteAdvSlide, fetchAdv, reorderAdvSlide, updateAdv, type Adv, type AdvFile, type AdvOrientation, type AdvPayload } from '@/api/tenant/advs'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlMenu from '@/components/DlMenu.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import AdvAudienceFields, { type AudienceRow } from './AdvAudienceFields.vue'
import { ADV_ACCEPT, COVER_ACCEPT, useAdvText } from './advDisplay'
import AdvPreview from './AdvPreview.vue'
import { useAdvLookups } from './useAdvLookups'

// One aide de visite: its cover, its files (a gallery is reordered by dragging or with the arrows), for whom.
// Each card is edited in place. Mockup: docs/design/engage-mockups/Advs.html (frame 2)
const props = defineProps<{ advId: number }>()
const emit = defineEmits<{ changed: []; deleted: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const text = useAdvText()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const { brands, teams, specialities, refresh } = useAdvLookups()
const canEdit = computed(() => auth.can('advs.update'))

const adv = ref<Adv | null>(null)
const busy = ref(false)
const previewing = ref(false)
const failed = (error: unknown) => toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))

async function load() {
  adv.value = null
  editing.value = null
  try {
    adv.value = await fetchAdv(props.advId)
  }
  catch (error) {
    failed(error)
  }
}

/** Runs a change, shows its result and tells the list. False when it failed. */
async function run(action: () => Promise<Adv>, done?: string): Promise<boolean> {
  busy.value = true
  try {
    adv.value = await action()
    if (done) toast.success(done)
    emit('changed')
    return true
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length || !editing.value) failed(error)
    return false
  }
  finally {
    busy.value = false
  }
}

// ── Cards edited in place: one at a time ────────────────────────────────────
type Part = 'what' | 'who'
const editing = ref<Part | null>(null)
const errors = ref<Record<string, string>>({})
const form = reactive({ name: '', brand_id: null as number | null, orientation: 'horizontal' as AdvOrientation, recommendation: '', teams: [] as AudienceRow[], specialities: [] as AudienceRow[] })
const rows = (list: Adv['teams']): AudienceRow[] => list.map(row => ({ id: row.id, start_date: row.start_date ?? '', end_date: row.end_date ?? '' }))
function edit(part: Part) {
  if (!adv.value) return
  Object.assign(form, {
    name: adv.value.name, brand_id: adv.value.brand?.id ?? null, orientation: adv.value.orientation, recommendation: adv.value.recommendation ?? '',
    teams: rows(adv.value.teams), specialities: rows(adv.value.specialities),
  })
  errors.value = {}
  editing.value = part
  refresh() // a brand or a team added meanwhile is in the selects
}
const audience = (list: AudienceRow[]) => list.map(row => ({ id: row.id, start_date: row.start_date || null, end_date: row.end_date || null }))
async function save() {
  const payload: AdvPayload = editing.value === 'what'
    ? { name: form.name.trim(), brand_id: form.brand_id ?? undefined, orientation: form.orientation, recommendation: form.recommendation.trim() || null }
    : { teams: audience(form.teams), specialities: audience(form.specialities) }
  if (await run(() => updateAdv(props.advId, payload), t('studio.list.toast.saved'))) editing.value = null
}
const brandModel = computed({ get: () => form.brand_id, set: value => { form.brand_id = value == null ? null : Number(value) } })
const orientationItems = computed(() => (['horizontal', 'vertical'] as const).map(value => ({ value, label: t(`advs.orientation.${value}`) })))
const rowErrors = (prefix: string) => Object.fromEntries(Object.entries(errors.value).filter(([key]) => key.startsWith(`${prefix}.`)).map(([key, message]) => [key.slice(prefix.length + 1), message]))

// ── Files ───────────────────────────────────────────────────────────────────
const slides = computed(() => adv.value?.slides ?? [])
const gallery = computed(() => adv.value?.type === 'galerie')
const coverInput = ref<HTMLInputElement | null>(null)
const filesInput = ref<HTMLInputElement | null>(null)
function pickCover(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) run(() => updateAdv(props.advId, { main_slide: file }), t('advs.toast.coverChanged'))
}
function pickFiles(event: Event) {
  const files = [...((event.target as HTMLInputElement).files ?? [])]
  if (files.length) run(() => updateAdv(props.advId, { slides: files }), t(gallery.value ? 'advs.toast.imagesAdded' : 'advs.toast.fileReplaced'))
  if (filesInput.value) filesInput.value.value = ''
}
const moveTo = (slide: AdvFile, order: number) => {
  if (order >= 1 && order <= slides.value.length && order !== slide.sort_order) run(() => reorderAdvSlide(props.advId, slide.id, order))
}
// Dragging a line onto another gives it that place.
const dragged = ref<AdvFile | null>(null)
function drop(target: AdvFile) {
  if (dragged.value && dragged.value.id !== target.id) moveTo(dragged.value, target.sort_order)
  dragged.value = null
}
async function removeSlide(slide: AdvFile) {
  const ok = await confirm({ title: t('advs.files.deleteTitle'), text: t('advs.files.deleteText', { name: slide.name ?? '' }), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (ok) run(() => deleteAdvSlide(props.advId, slide.id), t('studio.list.toast.deleted'))
}

// ── State and delete ────────────────────────────────────────────────────────
const toggleOnline = () => run(() => updateAdv(props.advId, { online: !adv.value!.online }), t(adv.value!.online ? 'advs.toast.offline' : 'advs.toast.online'))
async function remove() {
  if (!adv.value) return
  const ok = await confirm({ title: t('studio.list.delete.title', { name: adv.value.name }), text: t('advs.delete.text'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteAdv(props.advId)
    toast.success(t('studio.list.toast.deleted'))
    emit('deleted')
  }
  catch (error) {
    failed(error)
  }
}
const menuItems = computed(() => (auth.can('advs.delete') ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: remove }] : []))

watch(() => props.advId, load, { immediate: true })
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="adv?.name ?? t('advs.title')">
    <template v-if="adv" #badges>
      <span class="mt-1 flex flex-wrap items-center gap-1.5">
        <DlBadge size="sm" tone="info">{{ text.type(adv.type) }}</DlBadge>
        <DlBadge size="sm" :tone="adv.online ? 'success' : 'neutral'" dot>{{ t(`advs.state.${adv.online ? 'online' : 'offline'}`) }}</DlBadge>
      </span>
    </template>
    <template v-if="adv && menuItems.length" #actions>
      <DlMenu :label="t('advs.menu')" :items="menuItems" />
    </template>

    <div v-if="!adv" class="flex flex-col gap-3"><DlSkeleton v-for="i in 4" :key="i" class="h-16 rounded-2xl" /></div>
    <div v-else class="flex flex-col gap-3.5">
      <div class="relative overflow-hidden rounded-2xl bg-dl-mist">
        <img v-if="adv.main_slide?.url" :src="adv.main_slide.url" :alt="t('advs.fields.coverOf', { name: adv.name })" class="h-44 w-full object-cover">
        <span v-else class="flex h-44 items-center justify-center text-[13px] text-dl-muted">{{ t('advs.fields.noCover') }}</span>
        <template v-if="canEdit">
          <input ref="coverInput" type="file" class="sr-only" tabindex="-1" :accept="COVER_ACCEPT" :aria-label="t('advs.fields.cover')" @change="pickCover">
          <DlButton variant="dark" size="sm" icon="tabler-photo-edit" class="absolute bottom-2.5 end-2.5" :disabled="busy" @click="coverInput?.click()">{{ t('advs.files.changeCover') }}</DlButton>
        </template>
      </div>

      <dl class="grid grid-cols-3 gap-2">
        <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5">
          <dt class="order-2 text-[11.5px] text-dl-muted">{{ t(gallery ? 'advs.tiles.images' : 'advs.tiles.files') }}</dt>
          <dd class="font-display text-[22px] font-extrabold tracking-[-0.02em]">{{ n(adv.slides_count) }}</dd>
        </div>
        <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5">
          <dt class="order-2 text-[11.5px] text-dl-muted">{{ t('advs.tiles.people') }}</dt>
          <dd class="font-display text-[22px] font-extrabold tracking-[-0.02em]">{{ n(adv.people_count ?? 0) }}</dd>
        </div>
        <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5">
          <dt class="text-[11.5px] text-dl-muted">{{ t('advs.tiles.shown') }}</dt>
          <dd class="text-xs font-semibold text-dl-muted">{{ t('advs.tiles.withVisits') }}</dd>
        </div>
      </dl>

      <DlRecordSection :editing="editing === 'what'" :title="t('advs.add.step.what')" icon="tabler-presentation" :can-edit="canEdit && editing === null" :saving="busy" @update:editing="edit('what')" @save="save" @cancel="editing = null">
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <dt class="text-dl-muted">{{ t('advs.fields.brand') }}</dt><dd>{{ adv.brand?.name ?? '—' }}</dd>
          <dt class="text-dl-muted">{{ t('advs.fields.type') }}</dt><dd>{{ text.type(adv.type) }} · {{ t(`advs.orientation.${adv.orientation}`) }}</dd>
          <dt class="text-dl-muted">{{ t('advs.fields.recommendation') }}</dt><dd class="whitespace-pre-line">{{ adv.recommendation || '—' }}</dd>
        </dl>
        <template #edit>
          <div class="flex flex-col gap-3">
            <DlInput v-model="form.name" :label="t('advs.fields.name')" :error="errors.name" />
            <DlSelect v-model="brandModel" :label="t('advs.fields.brand')" :options="brands" />
            <DlSegmented v-model="form.orientation" :label="t('advs.fields.orientation')" :items="orientationItems" />
            <DlTextarea v-model="form.recommendation" :label="t('advs.fields.recommendation')" :rows="2" />
            <p class="text-xs text-dl-muted">{{ t('advs.fields.typeFixed') }}</p>
          </div>
        </template>
      </DlRecordSection>

      <section class="flex flex-col gap-2 rounded-2xl border border-dl-line p-3.5" :aria-label="t(gallery ? 'advs.tiles.images' : 'advs.tiles.files')">
        <header class="flex items-center gap-2">
          <DlIcon icon="tabler-files" :size="18" class="text-dl-muted" />
          <h3 class="flex-1 text-sm font-bold">{{ text.content(adv) }}</h3>
          <template v-if="canEdit">
            <input ref="filesInput" type="file" class="sr-only" tabindex="-1" :accept="ADV_ACCEPT[adv.type]" :multiple="gallery" :aria-label="t(gallery ? 'advs.files.addImages' : 'advs.files.replace')" @change="pickFiles">
            <DlButton variant="outline" size="sm" :icon="gallery ? 'tabler-plus' : 'tabler-replace'" :disabled="busy" @click="filesInput?.click()">{{ t(gallery ? 'advs.files.addImages' : 'advs.files.replace') }}</DlButton>
          </template>
        </header>
        <p v-if="!slides.length" class="text-[13px] text-dl-muted">{{ t('advs.files.none') }}</p>
        <ul class="flex flex-col gap-1">
          <li
            v-for="slide in slides"
            :key="slide.id"
            :draggable="canEdit && gallery && slides.length > 1"
            class="flex items-center gap-2 rounded-xl px-1.5 py-1.5 text-[13px]"
            :class="dragged?.id === slide.id && 'opacity-50'"
            @dragstart="dragged = slide"
            @dragend="dragged = null"
            @dragover.prevent
            @drop.prevent="drop(slide)"
          >
            <DlIcon v-if="canEdit && gallery && slides.length > 1" icon="tabler-grip-vertical" :size="16" class="shrink-0 cursor-grab text-dl-muted" aria-hidden="true" />
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dl-mist text-xs font-bold">{{ n(slide.sort_order) }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate">{{ slide.name ?? t('advs.files.unnamed') }}</span>
              <small class="block text-xs text-dl-muted">{{ text.size(slide.size) }}</small>
            </span>
            <template v-if="canEdit && gallery">
              <DlIconButton icon="tabler-arrow-up" variant="ghost" :size="30" :label="t('advs.files.moveUp', { name: slide.name ?? '' })" @click="moveTo(slide, slide.sort_order - 1)" />
              <DlIconButton icon="tabler-arrow-down" variant="ghost" :size="30" :label="t('advs.files.moveDown', { name: slide.name ?? '' })" @click="moveTo(slide, slide.sort_order + 1)" />
              <DlIconButton icon="tabler-trash" variant="ghost" :size="30" :label="t('advs.files.remove', { name: slide.name ?? '' })" @click="removeSlide(slide)" />
            </template>
          </li>
        </ul>
        <p v-if="canEdit && gallery && slides.length > 1" class="text-xs text-dl-muted">{{ t('advs.files.orderHint') }}</p>
      </section>

      <DlRecordSection :editing="editing === 'who'" :title="t('advs.add.step.who')" icon="tabler-users" :can-edit="canEdit && editing === null" :saving="busy" @update:editing="edit('who')" @save="save" @cancel="editing = null">
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <dt class="text-dl-muted">{{ t('advs.audience.teams') }}</dt>
          <dd><span v-for="row in adv.teams" :key="row.id" class="block">{{ text.audience(row) }}</span><template v-if="!adv.teams.length">—</template></dd>
          <dt class="text-dl-muted">{{ t('advs.audience.specialities') }}</dt>
          <dd><span v-for="row in adv.specialities" :key="row.id" class="block">{{ text.audience(row) }}</span><template v-if="!adv.specialities.length">—</template></dd>
        </dl>
        <p v-if="!adv.teams.length && !adv.specialities.length" class="mt-2 rounded-xl bg-dl-pending/8 px-3 py-2 text-xs text-dl-pending">{{ t('advs.audience.nobody') }}</p>
        <template #edit>
          <div class="flex flex-col gap-3">
            <AdvAudienceFields v-model="form.teams" :title="t('advs.audience.teams')" :add-label="t('advs.audience.addTeam')" :options="teams" :errors="rowErrors('teams')" />
            <AdvAudienceFields v-model="form.specialities" :title="t('advs.audience.specialities')" :add-label="t('advs.audience.addSpeciality')" :options="specialities" :errors="rowErrors('specialities')" />
          </div>
        </template>
      </DlRecordSection>

      <p class="text-xs text-dl-muted">{{ adv.created_by ? t('advs.read.addedBy', { name: adv.created_by.full_name, date: text.date(adv.created_at) }) : t('advs.read.added', { date: text.date(adv.created_at) }) }}</p>
    </div>

    <template v-if="adv" #footer>
      <DlButton v-if="canEdit" variant="outline" class="flex-1" :loading="busy" @click="toggleOnline">{{ t(adv.online ? 'advs.actions.putOffline' : 'advs.actions.putOnline') }}</DlButton>
      <DlButton variant="dark" icon="tabler-player-play" class="flex-1" :disabled="!slides.length" @click="previewing = true">{{ t('advs.actions.preview') }}</DlButton>
    </template>
  </DlRecordPanel>
  <AdvPreview v-if="previewing && adv" :adv="adv" @close="previewing = false" />
</template>

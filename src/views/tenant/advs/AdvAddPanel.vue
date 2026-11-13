<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { ADV_TYPES, createAdv, fetchAdvStorage, type Adv, type AdvOrientation, type AdvType } from '@/api/tenant/advs'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSteps from '@/components/DlSteps.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import AdvAudienceFields, { type AudienceRow } from './AdvAudienceFields.vue'
import { ADV_ACCEPT, COVER_ACCEPT, GB, useAdvText } from './advDisplay'
import AdvFileList from './AdvFileList.vue'
import { useAdvLookups } from './useAdvLookups'

// "Ajouter une aide de visite" in 3 steps: the aid, its files (with the lab's storage), for whom.
// Mockup: docs/design/engage-mockups/Advs.html (frames 3–6)
const emit = defineEmits<{ created: [adv: Adv] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const toast = useToast()
const text = useAdvText()
const { brands, teams, specialities, refresh } = useAdvLookups()
// The lists are asked again when the panel opens and when the person comes back to this tab: a brand they just
// added elsewhere is then in the select.
refresh()
window.addEventListener('focus', refresh)
onBeforeUnmount(() => window.removeEventListener('focus', refresh))

const form = reactive({
  name: '',
  brand_id: null as number | null,
  type: 'pdf' as AdvType,
  orientation: 'horizontal' as AdvOrientation,
  recommendation: '',
  online: 'online',
  cover: [] as File[],
  files: [] as File[],
  teams: [] as AudienceRow[],
  specialities: [] as AudienceRow[],
})
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const step = ref(0)
const stepLabels = computed(() => ['what', 'files', 'who'].map(key => t(`advs.add.step.${key}`)))

function setType(type: AdvType) {
  if (type === form.type) return
  form.type = type
  form.files = [] // the files of another type don't fit
}
const brandModel = computed({ get: () => form.brand_id, set: value => { form.brand_id = value == null ? null : Number(value) } })
const orientationItems = computed(() => (['horizontal', 'vertical'] as const).map(value => ({ value, label: t(`advs.orientation.${value}`) })))
const onlineItems = computed(() => (['online', 'offline'] as const).map(value => ({ value, label: t(`advs.state.${value}`) })))

// The lab's storage: what is used, the plan's limit, and whether the chosen files still fit.
const storage = ref<{ used_bytes: number; limit_gb: number | null } | null>(null)
fetchAdvStorage().then(value => { storage.value = value }).catch(() => undefined)
const chosenBytes = computed(() => [...form.cover, ...form.files].reduce((sum, file) => sum + file.size, 0))
const leftBytes = computed(() => (storage.value?.limit_gb == null ? null : Math.max(0, storage.value.limit_gb * GB - storage.value.used_bytes)))
const tooBig = computed(() => leftBytes.value !== null && chosenBytes.value > leftBytes.value)
const usedPercent = computed(() => (storage.value?.limit_gb ? Math.min(100, ((storage.value.used_bytes + chosenBytes.value) / (storage.value.limit_gb * GB)) * 100) : 0))

/** What must be filled before leaving a step; the API checks everything again. */
function check(): boolean {
  const found: Record<string, string> = {}
  const required = t('users.add.required')
  if (step.value === 0) {
    if (!form.name.trim()) found.name = required
    if (!form.brand_id) found.brand_id = required
  }
  if (step.value === 1) {
    if (!form.cover.length) found.main_slide = required
    if (!form.files.length) found.slides = required
  }
  errors.value = found
  return !Object.keys(found).length
}

const STEP_OF: Record<string, number> = { name: 0, brand_id: 0, type: 0, orientation: 0, recommendation: 0, main_slide: 1, slides: 1, teams: 2, specialities: 2 }
const audience = (rows: AudienceRow[]) => rows.map(row => ({ id: row.id, start_date: row.start_date || null, end_date: row.end_date || null }))

async function next() {
  if (!check() || (step.value === 1 && tooBig.value)) return
  if (step.value < 2) {
    step.value++
    return
  }
  saving.value = true
  try {
    const adv = await createAdv({
      name: form.name.trim(), brand_id: form.brand_id!, type: form.type, orientation: form.orientation,
      recommendation: form.recommendation.trim() || null, online: form.online === 'online',
      main_slide: form.cover[0], slides: form.files, teams: audience(form.teams), specialities: audience(form.specialities),
    })
    toast.success(t('advs.toast.added'))
    emit('created', adv)
  }
  catch (error) {
    // "slides.0.file" → "slides"; "teams.1.end_date" stays, for its own line.
    const found = Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, message]) => [key.startsWith('slides') ? 'slides' : key, message]))
    errors.value = found
    const first = Object.keys(found)[0]
    if (first) step.value = STEP_OF[first.split('.')[0]!] ?? step.value
    else toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
const rowErrors = (prefix: string) => Object.fromEntries(Object.entries(errors.value).filter(([key]) => key.startsWith(`${prefix}.`)).map(([key, message]) => [key.slice(prefix.length + 1), message]))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('advs.add.title')" :description="t('advs.add.stepOf', { step: n(step + 1), total: n(3), name: stepLabels[step] })">
    <form id="adv-add" class="flex flex-col gap-4" @submit.prevent="next">
      <DlSteps :steps="stepLabels" :current="step" />

      <template v-if="step === 0">
        <DlInput v-model="form.name" :label="t('advs.fields.name')" :error="errors.name" />
        <DlSelect v-model="brandModel" :label="t('advs.fields.brand')" :options="brands" :placeholder="t('advs.fields.brandPick')" />
        <p v-if="errors.brand_id" role="alert" class="-mt-2 text-xs text-dl-rejected">{{ errors.brand_id }}</p>
        <fieldset class="flex flex-col gap-2">
          <legend class="mb-2 text-[13px] font-semibold">{{ t('advs.fields.type') }}</legend>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="type in ADV_TYPES"
              :key="type"
              type="button"
              :aria-pressed="form.type === type"
              class="flex flex-col gap-0.5 rounded-2xl border px-3 py-2.5 text-start text-[13px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
              :class="form.type === type ? 'border-dl-ink ring-1 ring-dl-ink' : 'border-dl-line'"
              @click="setType(type)"
            >
              <strong>{{ text.type(type) }}</strong>
              <small class="text-xs text-dl-muted">{{ t(`advs.typeHint.${type}`) }}</small>
            </button>
          </div>
          <p class="text-xs text-dl-muted">{{ t('advs.fields.typeFixed') }}</p>
        </fieldset>
        <DlSegmented v-model="form.orientation" :label="t('advs.fields.orientation')" :items="orientationItems" />
        <DlTextarea v-model="form.recommendation" :label="t('advs.fields.recommendation')" :hint="t('advs.fields.recommendationHint')" :rows="2" />
      </template>

      <template v-else-if="step === 1">
        <AdvFileList v-model="form.cover" :label="t('advs.fields.cover')" :accept="COVER_ACCEPT" :error="errors.main_slide" />
        <AdvFileList v-model="form.files" :label="t(`advs.fields.content.${form.type}`)" :accept="ADV_ACCEPT[form.type]" :multiple="form.type === 'galerie'" :hint="t(`advs.typeHint.${form.type}`)" :error="errors.slides" />
        <div v-if="storage" class="flex flex-col gap-1.5 rounded-xl px-3 py-2.5 text-xs" :class="tooBig ? 'bg-dl-rejected/7 text-dl-rejected' : 'bg-dl-mist text-dl-muted'" aria-live="polite">
          <div class="flex justify-between gap-2">
            <span>{{ t('advs.storage.title') }}</span>
            <strong>{{ storage.limit_gb == null ? t('advs.storage.unlimited', { used: text.size(storage.used_bytes) }) : t('advs.storage.used', { used: text.size(storage.used_bytes), limit: n(storage.limit_gb) }) }}</strong>
          </div>
          <span v-if="storage.limit_gb" class="flex h-2 overflow-hidden rounded-full bg-dl-line-soft"><i class="block" :class="tooBig ? 'bg-dl-rejected' : 'bg-dl-ink'" :style="{ width: `${usedPercent}%` }" /></span>
          <span v-if="tooBig && leftBytes !== null">{{ t('advs.storage.full', { size: text.size(chosenBytes), left: text.size(leftBytes) }) }}</span>
        </div>
      </template>

      <template v-else>
        <AdvAudienceFields v-model="form.teams" :title="t('advs.audience.teams')" :add-label="t('advs.audience.addTeam')" :options="teams" :errors="rowErrors('teams')" />
        <AdvAudienceFields v-model="form.specialities" :title="t('advs.audience.specialities')" :add-label="t('advs.audience.addSpeciality')" :options="specialities" :errors="rowErrors('specialities')" />
        <p v-if="!form.teams.length && !form.specialities.length" class="rounded-xl bg-dl-pending/8 px-3 py-2 text-xs text-dl-pending">{{ t('advs.audience.nobody') }}</p>
        <DlSegmented v-model="form.online" :label="t('advs.fields.stateOnAdd')" :items="onlineItems" />
        <p class="-mt-2 text-xs text-dl-muted">{{ t('advs.fields.offlineHint') }}</p>
      </template>
    </form>
    <template #footer>
      <DlButton v-if="step > 0" variant="outline" icon="tabler-arrow-left" @click="step--">{{ t('fieldSetup.add.back') }}</DlButton>
      <DlButton v-else variant="outline" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="adv-add" :variant="step === 2 ? 'primary' : 'dark'" class="flex-1" :loading="saving" :disabled="step === 1 && tooBig">
        {{ step === 2 ? t('advs.add.save') : t('fieldSetup.add.next', { name: stepLabels[step + 1] }) }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>

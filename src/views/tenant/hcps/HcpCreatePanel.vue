<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createHcp, fetchHcpDuplicates, type Hcp } from '@/api/tenant/hcps'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSteps from '@/components/DlSteps.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import HcpFields from './HcpFields.vue'
import HcpWorkplaceFields from './HcpWorkplaceFields.vue'
import { avatarName, checkPart, emptyWorkplace, toForm, toPayload, useHcpText, type HcpPart, type WorkplaceForm } from './hcpForm'

// "Add a professional" in 3 steps: who (with a look-alike warning) · where · works at (+ external IDs).
// Mockup: docs/design/customers-mockups/Professionals.html (frames 3–5)
const emit = defineEmits<{ created: [hcp: Hcp] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const text = useHcpText()
// Without the right to approve, adding is a proposal a manager checks first.
const auth = useAuthStore()
const direct = computed(() => auth.can('hcp-requests.approve'))

const form = ref(toForm())
const workplaces = ref<WorkplaceForm[]>([])
const step = ref(0)
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const lookalikes = ref<Hcp[]>([])

watch(open, value => {
  if (!value) return
  form.value = toForm()
  workplaces.value = []
  step.value = 0
  errors.value = {}
  lookalikes.value = []
}, { immediate: true })

const steps = computed(() => [t('hcps.add.steps.who'), t('hcps.add.steps.where'), t('hcps.add.steps.works')])
const STEP_PARTS: HcpPart[][] = [['identity', 'contact'], ['place'], ['ids']]
const messages = computed(() => ({ required: t('users.add.required'), coordinates: t('hcps.fields.gpsInvalid') }))

function check(index: number) {
  const found: Record<string, string> = {}
  for (const part of STEP_PARTS[index] ?? []) Object.assign(found, checkPart(form.value, part, messages.value))
  if (index === 2) {
    workplaces.value.forEach((workplace, i) => {
      for (const key of ['hco_id', 'speciality_id', 'start_date'] as const)
        if (!workplace[key]) found[`workplaces.${i}.${key}`] = messages.value.required
    })
  }
  return found
}
function next() {
  errors.value = check(step.value)
  if (!Object.keys(errors.value).length) step.value++
}

// Look-alikes: same name, phone or e-mail, checked while typing in step 1. Warns, never blocks.
let timer: ReturnType<typeof setTimeout> | undefined
let request = 0
watch(() => [form.value.name, form.value.phone, form.value.email], ([name, phone, email]) => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const current = ++request
    const query = { name: name?.trim() || undefined, phone: phone?.trim() || undefined, email: email?.trim() || undefined }
    if (!query.name && !query.phone && !query.email) {
      lookalikes.value = []
      return
    }
    try {
      const rows = await fetchHcpDuplicates(query)
      if (current === request) lookalikes.value = rows
    }
    catch {
      // Only a warning.
    }
  }, 400)
})
const matchText = (hcp: Hcp) => (hcp.match ?? []).map(key => t(`hcps.add.match.${key}`)).join(' · ')

async function save() {
  for (const index of [0, 1, 2]) {
    errors.value = check(index)
    if (Object.keys(errors.value).length) {
      step.value = index
      return
    }
  }
  saving.value = true
  try {
    const payload = {
      ...toPayload(form.value),
      workplaces: workplaces.value.map(w => ({ hco_id: w.hco_id as number, speciality_id: w.speciality_id as number, start_date: w.start_date })),
    }
    const created = await createHcp(payload)
    toast.success(t(direct.value ? 'hcps.add.done' : 'hcps.requests.sent', { name: form.value.name.trim() }))
    emit('created', created)
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) {
      toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
      return
    }
    const firstStep = (key: string) => (['name', 'type', 'gender', 'phone', 'email', 'fax', 'contacted_by'].includes(key) ? 0 : ['commune_id', 'address', 'latitude', 'longitude'].includes(key) ? 1 : 2)
    step.value = Math.min(...Object.keys(errors.value).map(firstStep))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('hcps.add.title')" :description="t('teams.add.step', { n: step + 1, total: 3, name: steps[step] })">
    <form id="hcp-create" class="flex flex-col gap-4" @submit.prevent="step < 2 ? next() : save()">
      <DlSteps :steps="steps" :current="step" />

      <template v-if="step === 0">
        <HcpFields v-model:form="form" part="identity" :errors="errors" />
        <HcpFields v-model:form="form" part="contact" :errors="errors" />
        <section v-if="lookalikes.length" class="flex flex-col gap-2 rounded-2xl bg-dl-pending/10 px-3.5 py-3 text-[13px]" aria-live="polite">
          <strong class="flex items-center gap-1.5 text-dl-pending"><DlIcon icon="tabler-alert-triangle" :size="16" />{{ t('hcps.add.lookalike.title', lookalikes.length) }}</strong>
          <p class="text-dl-body">{{ t('hcps.add.lookalike.text') }}</p>
          <RouterLink
            v-for="hcp in lookalikes"
            :key="hcp.id"
            :to="{ name: 'tenant-hcp-detail', params: { id: hcp.id } }"
            target="_blank"
            class="flex items-center gap-2.5 rounded-xl bg-dl-paper px-3 py-2 text-dl-fg no-underline hover:ring-1 hover:ring-dl-line"
          >
            <DlAvatar :name="avatarName(hcp.name)" size="sm" tone="neutral" />
            <span class="flex min-w-0 flex-1 flex-col">
              <strong class="truncate font-semibold">{{ hcp.name }}</strong>
              <span class="truncate text-xs text-dl-muted">{{ [text.type(hcp.type), text.mainWorkplace(hcp).speciality, text.place(hcp)].filter(Boolean).join(' · ') }}</span>
              <span class="text-xs text-dl-pending">{{ matchText(hcp) }}</span>
            </span>
            <DlIcon icon="tabler-arrow-up-right" :size="16" class="text-dl-muted" />
          </RouterLink>
        </section>
      </template>

      <HcpFields v-else-if="step === 1" v-model:form="form" part="place" :errors="errors" />

      <template v-else>
        <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('hcps.add.worksHint') }}</p>
        <section v-for="(_, index) in workplaces" :key="index" class="flex flex-col gap-2 rounded-2xl border border-dl-line p-3">
          <div class="flex items-center justify-between">
            <strong class="text-[13px] font-semibold">{{ t('hcps.workplaces.number', { n: index + 1 }) }}</strong>
            <button type="button" class="text-[13px] font-semibold text-dl-muted hover:underline" @click="workplaces.splice(index, 1)">{{ t('hcps.workplaces.remove') }}</button>
          </div>
          <HcpWorkplaceFields
            v-model:form="workplaces[index]!"
            :errors="{ hco_id: errors[`workplaces.${index}.hco_id`], speciality_id: errors[`workplaces.${index}.speciality_id`], start_date: errors[`workplaces.${index}.start_date`] }"
          />
        </section>
        <DlButton variant="outline" size="sm" icon="tabler-plus" class="self-start" @click="workplaces.push(emptyWorkplace())">
          {{ t(workplaces.length ? 'hcps.workplaces.another' : 'hcps.workplaces.add') }}
        </DlButton>
        <h3 class="mt-1 text-[13px] font-semibold">{{ t('hcps.read.ids') }}</h3>
        <HcpFields v-model:form="form" part="ids" :errors="errors" />
        <p v-if="!direct" class="flex gap-2 rounded-xl bg-dl-pending/10 px-3 py-2.5 text-[13px] text-dl-body">
          <DlIcon icon="tabler-info-circle" :size="17" class="mt-px text-dl-pending" />{{ t('hcps.requests.note') }}
        </p>
      </template>
    </form>

    <template #footer>
      <DlButton v-if="step === 0" variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton v-else variant="ghost" @click="step--">{{ t('users.add.back') }}</DlButton>
      <DlButton v-if="step < 2" type="submit" form="hcp-create" variant="dark" class="ms-auto">{{ t('users.add.next') }}</DlButton>
      <DlButton v-else type="submit" form="hcp-create" variant="primary" class="ms-auto" :loading="saving">{{ t(direct ? 'hcps.add.save' : 'hcps.requests.send') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

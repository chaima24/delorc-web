<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchCanals } from '@/api/tenant/fieldSetup'
import { fetchVisitSettings, saveVisitSettings } from '@/api/tenant/visitPlanning'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { fieldSection } from '@/views/tenant/settings/shared/studioSections'

// Studio › Configuration terrain › Planning des visites: the lab's four settings for planning visits, kept in the
// lab's own settings (like the working week). Mockup: docs/design/visits-mockups/Planning.html (frame 7)
const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const canEdit = computed(() => auth.can('calendar.update'))

const loading = ref(true)
const saving = ref(false)
const errors = ref<Record<string, string>>({})
const form = reactive({ max: '', planAfter: 'yes', canal: null as number | null, addAfter: 'no' })
const canals = ref<{ value: number; label: string }[]>([])
const yesNo = (yes: string, no: string) => [{ value: 'yes', label: t(yes) }, { value: 'no', label: t(no) }]
const canalModel = computed({ get: () => form.canal, set: value => { form.canal = value == null ? null : Number(value) } })

async function load() {
  const [settings, list] = await Promise.all([fetchVisitSettings(), fetchCanals({ per_page: 100, sort: 'name' })])
  canals.value = list.items.map(row => ({ value: row.id, label: row.name }))
  if (loading.value) {
    Object.assign(form, {
      max: settings.max_doctors_per_day == null ? '' : String(settings.max_doctors_per_day),
      planAfter: settings.plan_after_deadline ? 'yes' : 'no', canal: settings.default_canal_id, addAfter: settings.add_after_delay ? 'yes' : 'no',
    })
  }
  loading.value = false
}
// The canals are asked again on coming back to the tab; the form keeps what was typed.
onMountedAndFocus(load)

async function save() {
  saving.value = true
  errors.value = {}
  try {
    await saveVisitSettings({
      max_doctors_per_day: form.max === '' ? null : Number(form.max), plan_after_deadline: form.planAfter === 'yes',
      default_canal_id: form.canal, add_after_delay: form.addAfter === 'yes',
    })
    toast.success(t('studio.list.toast.saved'))
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <StudioListPage :section="fieldSection" :title="t('visits.settings.title')">
    <div v-if="loading" class="flex max-w-3xl flex-col gap-4"><DlSkeleton v-for="i in 4" :key="i" class="h-28 rounded-3xl" /></div>
    <form v-else class="flex max-w-3xl flex-col gap-4" @submit.prevent="save">
      <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
        <h2 class="text-base font-semibold">{{ t('visits.settings.maxDoctors') }}</h2>
        <p class="text-[13px] text-dl-muted">{{ t('visits.settings.maxDoctorsHint') }}</p>
        <div class="w-40"><DlInput v-model="form.max" type="number" min="1" :label="t('visits.settings.maxDoctors')" :placeholder="t('visits.settings.noLimit')" :error="errors.max_doctors_per_day" :disabled="!canEdit" hide-label /></div>
      </section>
      <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
        <h2 class="text-base font-semibold">{{ t('visits.settings.planAfter') }}</h2>
        <p class="text-[13px] text-dl-muted">{{ t('visits.settings.planAfterHint') }}</p>
        <DlSegmented v-model="form.planAfter" :label="t('visits.settings.planAfter')" :items="yesNo('visits.settings.planAfterYes', 'visits.settings.planAfterNo')" class="self-start" :class="!canEdit && 'pointer-events-none opacity-60'" />
      </section>
      <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
        <h2 class="text-base font-semibold">{{ t('visits.settings.addAfter') }}</h2>
        <p class="text-[13px] text-dl-muted">{{ t('visits.settings.addAfterHint') }}</p>
        <DlSegmented v-model="form.addAfter" :label="t('visits.settings.addAfter')" :items="yesNo('visits.settings.addAfterYes', 'visits.settings.addAfterNo')" class="self-start" :class="!canEdit && 'pointer-events-none opacity-60'" />
      </section>
      <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
        <h2 class="text-base font-semibold">{{ t('visits.settings.defaultCanal') }}</h2>
        <p class="text-[13px] text-dl-muted">{{ t('visits.settings.defaultCanalHint') }}</p>
        <div class="max-w-xs"><DlSelect v-model="canalModel" :label="t('visits.settings.defaultCanal')" :options="canals" :placeholder="t('visits.form.pickCanal')" :disabled="!canEdit" hide-label /></div>
        <span v-if="errors.default_canal_id" class="text-xs text-dl-rejected">{{ errors.default_canal_id }}</span>
      </section>
      <p class="text-xs text-dl-muted">{{ t('visits.settings.rulesHint') }}</p>
      <DlButton v-if="canEdit" type="submit" variant="dark" class="self-start" :loading="saving">{{ t('common.actions.save') }}</DlButton>
    </form>
  </StudioListPage>
</template>

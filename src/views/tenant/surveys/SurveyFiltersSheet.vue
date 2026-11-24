<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchSegmentations, fetchSpecialities } from '@/api/tenant/customerSetup'
import { errorMessage } from '@/api/errors'
import { fetchWilayas } from '@/api/tenant/geography'
import { updateSurvey, type Survey } from '@/api/tenant/surveys'
import DlButton from '@/components/DlButton.vue'
import DlSheet from '@/components/DlSheet.vue'
import { useToast } from '@/composables/useToast'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'

// « Filtres de copie »: specialities, segments of the cycle, wilayas; empty = all. Used by each add and each recopy;
// lists already copied don't change. Mockup: surveys-mockups/Respondents.html frame 3.
const props = defineProps<{ survey: Survey }>()
const emit = defineEmits<{ saved: [survey: Survey] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

type Option = { value: number; label: string }
const specialities = ref<Option[]>([])
const segments = ref<Option[]>([])
const wilayas = ref<Option[]>([])
const form = ref({ speciality_ids: [] as number[], segmentation_ids: [] as number[], wilaya_ids: [] as number[] })
const saving = ref(false)
watch(open, async value => {
  if (!value) return
  form.value = { ...props.survey.copy_filters }
  const [s, g, w] = await Promise.all([
    fetchSpecialities({ per_page: 100, sort: 'name' }).catch(() => ({ items: [] })),
    fetchSegmentations({ per_page: 100, sort: 'position', 'filter[type]': 'cycle_target' }).catch(() => ({ items: [] })),
    fetchWilayas({ per_page: 100, sort: 'name' }).catch(() => ({ items: [] })),
  ])
  specialities.value = s.items.map(row => ({ value: row.id, label: row.name }))
  segments.value = g.items.map(row => ({ value: row.id, label: row.name }))
  wilayas.value = w.items.map(row => ({ value: row.id, label: row.name }))
}, { immediate: true })
const chosen = (count: number) => (count ? t('surveys.respondents.filterCount', { count }, count) : t('surveys.respondents.filterAll'))
const lists = computed(() => [
  { key: 'speciality_ids' as const, legend: t('surveys.respondents.specialities'), items: specialities.value },
  { key: 'segmentation_ids' as const, legend: t('surveys.respondents.segmentsOfCycle'), items: segments.value },
  { key: 'wilaya_ids' as const, legend: t('surveys.respondents.wilayas'), items: wilayas.value },
])

async function save() {
  saving.value = true
  try {
    emit('saved', await updateSurvey(props.survey.id, { copy_filters: form.value }))
    toast.success(t('studio.list.toast.saved'))
    open.value = false
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlSheet v-model:open="open" :title="t('surveys.respondents.filters')" :description="t('surveys.respondents.filtersSheetHint')">
    <div class="flex flex-col gap-5">
      <CheckList
        v-for="list in lists"
        :key="list.key"
        v-model="form[list.key]"
        :legend="list.legend"
        :selected-label="chosen(form[list.key].length)"
        :search-label="t('common.search.typeToSearch')"
        :items="list.items"
        :empty-text="t('surveys.respondents.filterNone')"
      />
      <p class="rounded-2xl bg-dl-mist px-4 py-3 text-[13px] text-dl-muted">{{ t('surveys.respondents.filtersNote') }}</p>
    </div>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton variant="primary" :loading="saving" @click="save">{{ t('geo.save') }}</DlButton>
    </template>
  </DlSheet>
</template>

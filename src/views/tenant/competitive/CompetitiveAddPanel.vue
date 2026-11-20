<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createCompetitiveInformation, type CompetitiveForm, type CompetitiveInformation } from '@/api/tenant/competitive'
import DlButton from '@/components/DlButton.vue'
import DlDatePicker from '@/components/DlDatePicker.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useToast } from '@/composables/useToast'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import { today } from './competitiveDisplay'

// « Nouvelle note »: the day seen, the competitor, its product, our brand, the source. The rest is filled on the
// note's page. Mockup: competitive-mockups/CompetitiveInformation.html frame 2.
const props = defineProps<{ lists: CompetitiveForm | null; brands: { value: number; label: string }[] }>()
const emit = defineEmits<{ created: [note: CompetitiveInformation] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const NONE = 0
const empty = () => ({ seen_on: today(), laboratory: '', product: '', brand_id: NONE, sources: [] as number[] })
const form = ref(empty())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  form.value = empty()
  errors.value = {}
}, { immediate: true })
const brandOptions = computed(() => [{ value: NONE, label: t('competitive.fields.noBrand') }, ...props.brands])
const sourceItems = computed(() => (props.lists?.source ?? []).map(item => ({ value: item.id, label: item.content })))

async function save() {
  errors.value = {}
  saving.value = true
  try {
    const created = await createCompetitiveInformation({
      seen_on: form.value.seen_on,
      laboratory: form.value.laboratory,
      product: form.value.product,
      brand_id: form.value.brand_id || null,
      details: form.value.sources.map(id => ({ type: 'source', competitive_type_id: id })),
    })
    toast.success(t('competitive.add.done'))
    emit('created', created)
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
  <DlRecordPanel v-model:open="open" :title="t('competitive.add.title')" :description="t('competitive.add.description')">
    <form id="competitive-add" class="flex flex-col gap-4" @submit.prevent="save">
      <DlDatePicker v-model="form.seen_on" :label="t('competitive.fields.seenOn')" :max="today()" :error="errors.seen_on" />
      <DlInput v-model="form.laboratory" :label="t('competitive.fields.laboratory')" :error="errors.laboratory" />
      <DlInput v-model="form.product" :label="t('competitive.fields.product')" :error="errors.product" />
      <DlSelect v-model="form.brand_id" :label="t('competitive.fields.brand')" :options="brandOptions" />
      <CheckList
        v-model="form.sources"
        :legend="t('competitive.lists.source')"
        :selected-label="t('competitive.fields.chosen', { count: form.sources.length }, form.sources.length)"
        :search-label="t('competitive.fields.search')"
        :items="sourceItems"
        :empty-text="t('competitive.fields.listEmpty')"
        :error="errors['details.0.competitive_type_id']"
      />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="competitive-add" variant="primary" class="ms-auto" :loading="saving">{{ t('competitive.add.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

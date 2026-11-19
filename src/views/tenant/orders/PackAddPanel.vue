<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createPack, type Pack } from '@/api/tenant/orders'
import DlButton from '@/components/DlButton.vue'
import DlDateRangePicker from '@/components/DlDateRangePicker.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { useToast } from '@/composables/useToast'

// "Ajouter une offre": name, period, active, one field per row. Brackets and objectives go on its page. Mockup frame 2.
const emit = defineEmits<{ created: [pack: Pack] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const form = ref({ name: '', start_date: '', end_date: '', is_active: true })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  form.value = { name: '', start_date: '', end_date: '', is_active: true }
  errors.value = {}
}, { immediate: true })

async function save() {
  errors.value = {}
  saving.value = true
  try {
    const created = await createPack(form.value)
    toast.success(t('orders.packs.add.done'))
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
  <DlRecordPanel v-model:open="open" :title="t('orders.packs.add.title')" :description="t('orders.packs.add.description')">
    <form id="pack-add" class="flex flex-col gap-4" @submit.prevent="save">
      <DlInput v-model="form.name" :label="t('orders.packs.fields.name')" :error="errors.name" />
      <DlDateRangePicker v-model:start="form.start_date" v-model:end="form.end_date" :label="t('common.dates.period')" :error="errors.start_date || errors.end_date" />
      <DlSwitch v-model="form.is_active" :label="t('orders.packs.fields.active')" />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="pack-add" variant="primary" class="ms-auto" :loading="saving">{{ t('orders.packs.add.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

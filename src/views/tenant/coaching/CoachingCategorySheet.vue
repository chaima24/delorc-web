<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createCoachingCategory, updateCoachingCategory } from '@/api/tenant/coaching'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useToast } from '@/composables/useToast'

// Add or rename a family (no parent) or a section (parent = a family).
const props = defineProps<{
  /** The category renamed, or null to add one. */
  category: { id: number; name: string } | null
  /** Adding a section: its family. */
  family: { id: number; name: string } | null
}>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const name = ref('')
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  name.value = props.category?.name ?? ''
  errors.value = {}
}, { immediate: true })

const title = computed(() => props.category
  ? t('coaching.grid.rename')
  : props.family ? t('coaching.grid.addSection') : t('coaching.grid.addFamily'))

async function save() {
  errors.value = {}
  saving.value = true
  try {
    if (props.category) await updateCoachingCategory(props.category.id, { name: name.value })
    else await createCoachingCategory({ name: name.value, parent_id: props.family?.id ?? null })
    toast.success(t('studio.list.toast.saved'))
    open.value = false
    emit('saved')
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
  <DlRecordPanel v-model:open="open" :title="title" :description="family ? t('coaching.grid.inFamily', { name: family.name }) : undefined">
    <form id="coaching-category" class="flex flex-col gap-4" @submit.prevent="save">
      <DlInput v-model="name" :label="t('coaching.fields.name')" :error="errors.name || errors.parent_id" />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="coaching-category" variant="primary" class="ms-auto" :loading="saving">{{ t('common.actions.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

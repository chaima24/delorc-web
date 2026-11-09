<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createBrand, type Brand } from '@/api/tenant/brands'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useToast } from '@/composables/useToast'
import BrandTeamsField from './BrandTeamsField.vue'

// "Add a brand": a name and, optionally, the teams that promote it.
const emit = defineEmits<{ created: [brand: Brand] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const form = reactive({ name: '', teams: [] as number[] })
const errors = ref<Record<string, string>>({})
const saving = ref(false)

watch(open, value => {
  if (!value) return
  Object.assign(form, { name: '', teams: [] })
  errors.value = {}
})

async function save() {
  if (!form.name.trim()) {
    errors.value = { name: t('users.add.required') }
    return
  }
  saving.value = true
  errors.value = {}
  try {
    const brand = await createBrand({ name: form.name.trim(), teams: form.teams })
    toast.success(t('brands.add.done', { name: form.name.trim() }))
    emit('created', brand)
  }
  catch (error) {
    errors.value = Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, message]) => [key.split('.')[0]!, message]))
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('brands.add.title')">
    <form id="brand-create" class="flex flex-col gap-4" @submit.prevent="save">
      <DlInput v-model="form.name" :label="t('brands.fields.name')" :error="errors.name" />
      <BrandTeamsField v-model="form.teams" :error="errors.teams" />
    </form>

    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="brand-create" variant="primary" class="ms-auto" :loading="saving">
        {{ form.name.trim() ? t('brands.add.saveNamed', { name: form.name.trim() }) : t('brands.add.save') }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>

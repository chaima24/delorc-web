<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createPackCommande, type ClientType, type PackCommande } from '@/api/tenant/orders'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import { useOrdersText } from './ordersDisplay'

// "Ajouter un pack": name, buyer type, description, active. Its products are added on its page. Mockup frame 7.
const emit = defineEmits<{ created: [pack: PackCommande] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const text = useOrdersText()

const form = ref({ name: '', client_type: 'pharmacy' as ClientType, description: '', is_active: true })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  form.value = { name: '', client_type: 'pharmacy', description: '', is_active: true }
  errors.value = {}
}, { immediate: true })
const types = computed(() => (['pharmacy', 'wholesaler'] as const).map(value => ({ value, label: text.clientType(value) })))
const clientType = computed({ get: () => form.value.client_type as string, set: value => { form.value.client_type = value as ClientType } })

async function save() {
  errors.value = {}
  saving.value = true
  try {
    const created = await createPackCommande({ ...form.value, description: form.value.description || null })
    toast.success(t('orders.packCommandes.add.done'))
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
  <DlRecordPanel v-model:open="open" :title="t('orders.packCommandes.add.title')" :description="t('orders.packCommandes.add.description')">
    <form id="pack-commande-add" class="flex flex-col gap-4" @submit.prevent="save">
      <DlInput v-model="form.name" :label="t('orders.packCommandes.fields.name')" :error="errors.name" />
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('orders.packCommandes.fields.for') }}</span>
        <DlSegmented v-model="clientType" :label="t('orders.packCommandes.fields.for')" :items="types" block />
        <p v-if="errors.client_type" class="text-xs text-dl-rejected">{{ errors.client_type }}</p>
      </div>
      <DlTextarea v-model="form.description" :label="t('orders.packCommandes.fields.description')" :error="errors.description" />
      <DlSwitch v-model="form.is_active" :label="t('orders.packCommandes.fields.active')" />
      <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('orders.packCommandes.add.hint') }}</p>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="pack-commande-add" variant="primary" class="ms-auto" :loading="saving">{{ t('orders.packCommandes.add.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

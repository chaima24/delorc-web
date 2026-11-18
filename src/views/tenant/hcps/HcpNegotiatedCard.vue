<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { updateHcp, type Hcp } from '@/api/tenant/hcps'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

// « Commandes »: the % negotiated with this customer (docs/api/orders.md). Shown only when Commandes › Réglages has
// the negotiated discount on; the roles chosen there use it instead of the offer's brackets. Mockup: Orders.html frame 10.
const props = defineProps<{ hcp: Hcp }>()
const emit = defineEmits<{ changed: [] }>()
const { t, n } = useI18n()
const auth = useAuthStore()
const toast = useToast()

const editing = ref(false)
const value = ref('')
const error = ref('')
const saving = ref(false)
function start(on: boolean) {
  value.value = props.hcp.negotiated_discount == null ? '' : String(Number(props.hcp.negotiated_discount))
  error.value = ''
  editing.value = on
}
async function save() {
  saving.value = true
  try {
    await updateHcp(props.hcp.id, { negotiated_discount: value.value.trim() === '' ? null : Number(value.value.replace(',', '.')) })
    editing.value = false
    emit('changed')
  }
  catch (failure) {
    error.value = fieldErrors(failure).negotiated_discount ?? ''
    if (!error.value) toast.error(errorMessage(failure) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordSection :editing="editing" :title="t('orders.hcp.title')" icon="tabler-discount" :can-edit="auth.can('hcps.update')" :saving="saving" class="bg-dl-paper" @update:editing="start" @save="save" @cancel="start(false)">
    <dl class="grid grid-cols-[150px_1fr] gap-3 py-1">
      <dt class="text-dl-muted">{{ t('orders.hcp.negotiated') }}</dt>
      <dd>{{ hcp.negotiated_discount == null ? t('orders.hcp.none') : `${n(Number(hcp.negotiated_discount))} %` }}</dd>
    </dl>
    <template #edit>
      <DlInput v-model="value" inputmode="decimal" :label="t('orders.hcp.negotiated')" :placeholder="t('orders.hcp.none')" :error="error">
        <template #end><span class="pe-3 text-dl-muted">%</span></template>
      </DlInput>
      <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('orders.hcp.hint') }}</p>
    </template>
  </DlRecordSection>
</template>

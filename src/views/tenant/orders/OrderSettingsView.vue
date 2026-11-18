<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchOrderSettings, saveOrderSettings } from '@/api/tenant/orders'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

// Commandes › Réglages, as Coaching › Réglages: the strategic threshold. Mockup frame 10.
const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const canEdit = computed(() => auth.can('orders-setup.update'))

const saved = ref<number | null>(null)
const value = ref('')
const error = ref('')
const saving = ref(false)
fetchOrderSettings().then(settings => {
  saved.value = settings.strategic_percentage
  value.value = String(settings.strategic_percentage)
})
const changed = computed(() => saved.value != null && value.value !== String(saved.value))

async function save() {
  error.value = ''
  saving.value = true
  try {
    const settings = await saveOrderSettings({ strategic_percentage: Number(value.value) })
    saved.value = settings.strategic_percentage
    value.value = String(settings.strategic_percentage)
    toast.success(t('studio.list.toast.saved'))
  }
  catch (failure) {
    error.value = fieldErrors(failure).strategic_percentage ?? ''
    if (!error.value) toast.error(errorMessage(failure) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-sm text-dl-muted">{{ t('nav.workspaces.orders') }}</span>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('orders.settings.title') }}</h1>
      <p class="text-[13px] text-dl-muted">{{ t('orders.settings.subtitle') }}</p>
    </div>
    <DlSkeleton v-if="saved == null" class="h-40 rounded-3xl" />
    <form v-else class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" @submit.prevent="save">
      <strong class="text-sm">{{ t('orders.settings.strategic') }}</strong>
      <div class="w-56">
        <DlInput v-model="value" inputmode="numeric" :label="t('orders.settings.strategicField')" :disabled="!canEdit" :error="error">
          <template #end><span class="pe-3 text-dl-muted">%</span></template>
        </DlInput>
      </div>
      <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('orders.settings.strategicHint', { value: value || saved }) }}</p>
      <div v-if="canEdit" class="flex justify-end gap-2">
        <DlButton variant="ghost" :disabled="!changed" @click="value = String(saved)">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton type="submit" variant="dark" :disabled="!changed" :loading="saving">{{ t('common.actions.save') }}</DlButton>
      </div>
    </form>
  </div>
</template>

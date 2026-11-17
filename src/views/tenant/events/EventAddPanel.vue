<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createEvent, type LabEvent } from '@/api/tenant/events'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSheet from '@/components/DlSheet.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import EventFields from './EventFields.vue'
import { emptyEventForm, formToPayload } from './eventForm'

// « + Créer un événement » (marketing: validated at once) or « + Proposer un événement » (the field: waits for someone
// above). A panel beside Engager › Événements; a sheet inside a campaign (`campaignId`), as every window of the
// campaign's tabs. Mockup frames 2 and 3.
const props = defineProps<{ campaignId?: number | null }>()
const emit = defineEmits<{ created: [event: LabEvent] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const manage = computed(() => auth.can('events.manage'))

const form = ref(emptyEventForm())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  form.value = emptyEventForm(manage.value || !auth.user ? [] : [auth.user.id], props.campaignId ?? null)
  errors.value = {}
}, { immediate: true })

async function save() {
  errors.value = {}
  saving.value = true
  try {
    const created = await createEvent(formToPayload(form.value))
    toast.success(created.status === 'validated' ? t('events.add.doneValidated') : t('events.add.doneProposed'))
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
  <component :is="campaignId ? DlSheet : DlRecordPanel" v-model:open="open" :size="campaignId ? 'lg' : undefined" :title="manage ? t('events.add.titleCreate') : t('events.add.titlePropose')" :description="manage ? t('events.add.hintCreate') : t('events.add.hintPropose')">
    <form id="event-add" @submit.prevent="save">
      <EventFields v-model="form" :errors="errors" :manage="manage" :wide="!!campaignId" />
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="event-add" variant="primary" class="ms-auto" :loading="saving">{{ manage ? t('events.add.create') : t('events.add.propose') }}</DlButton>
    </template>
  </component>
</template>

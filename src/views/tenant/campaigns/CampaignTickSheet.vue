<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createTick, deleteTick, updateTick, type CampaignSettings, type CampaignTick } from '@/api/tenant/campaigns'
import DlButton from '@/components/DlButton.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import { useCampaignLookups } from './useCampaignLookups'

/** The cell a tick is for: a team of the campaign × a brand × a speciality, and the tick when there is one. */
export interface TickCell {
  campaignId: number
  team: { id: number; name: string }
  brand: { id: number; name: string }
  speciality: { id: number; name: string }
  tick: CampaignTick | null
}

// The tick window: the priority (the lab's list, or none) and the message. Required or not by the lab's settings;
// "Décocher" removes the tick. Mockup frame 5.
const props = defineProps<{ cell: TickCell; settings: CampaignSettings }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const { priorities } = useCampaignLookups()

const priorityId = ref<number | null>(props.cell.tick?.priority?.id ?? null)
const message = ref(props.cell.tick?.message ?? '')
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const title = computed(() => `${props.cell.brand.name} · ${props.cell.team.name} · ${props.cell.speciality.name}`)

async function run(action: () => Promise<unknown>) {
  errors.value = {}
  saving.value = true
  try {
    await action()
    emit('saved')
    open.value = false
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}

const save = () => run(() => {
  const body = { priority_id: priorityId.value, message: message.value.trim() || null }
  return props.cell.tick
    ? updateTick(props.cell.tick.id, body)
    : createTick({ campaign_id: props.cell.campaignId, team_id: props.cell.team.id, brand_id: props.cell.brand.id, speciality_id: props.cell.speciality.id, ...body })
})
const untick = () => props.cell.tick && run(() => deleteTick(props.cell.tick!.id))
</script>

<template>
  <DlSheet v-model:open="open" :title="title" :description="t(cell.tick ? 'campaigns.tick.editHint' : 'campaigns.tick.newHint')">
    <form id="campaign-tick" class="flex flex-col gap-4" @submit.prevent="save">
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-1.5 text-[13px] font-semibold">{{ t('campaigns.tick.priority') }}<span v-if="settings.priority_required"> *</span></legend>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="priority in [...priorities, null]"
            :key="priority?.id ?? 'none'"
            type="button"
            class="inline-flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] py-1 ps-1 pe-3 text-[13px] font-semibold"
            :class="priorityId === (priority?.id ?? null) ? 'border-dl-fg bg-dl-mist' : 'border-dl-line'"
            :aria-pressed="priorityId === (priority?.id ?? null)"
            @click="priorityId = priority?.id ?? null"
          >
            <span class="inline-flex h-[22px] min-w-[26px] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold text-white" :style="{ background: priority?.color ?? 'var(--color-dl-ink)' }">{{ priority?.name ?? '—' }}</span>
            {{ priority ? '' : t('campaigns.tick.noPriority') }}
          </button>
        </div>
        <p v-if="!priorities.length" class="text-xs text-dl-muted">{{ t('campaigns.tick.noPriorities') }}</p>
        <p v-if="errors.priority_id" class="text-xs text-dl-rejected">{{ errors.priority_id }}</p>
      </fieldset>
      <DlTextarea v-model="message" :label="settings.message_required ? `${t('campaigns.tick.message')} *` : t('campaigns.tick.message')" :placeholder="t('campaigns.tick.messagePlaceholder')" :rows="4" :error="errors.message" />
      <p v-if="errors.brand_id || errors.speciality_id || errors.team_id" class="text-xs text-dl-rejected">{{ errors.brand_id || errors.speciality_id || errors.team_id }}</p>
      <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-xs text-dl-muted">{{ t('campaigns.tick.note', { team: cell.team.name, speciality: cell.speciality.name }) }}</p>
    </form>
    <template #footer>
      <DlButton v-if="cell.tick" variant="ghost" icon="tabler-square-off" :disabled="saving" @click="untick">{{ t('campaigns.tick.untick') }}</DlButton>
      <DlButton v-else variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="campaign-tick" variant="primary" class="ms-auto" :loading="saving">{{ t(cell.tick ? 'common.actions.save' : 'campaigns.tick.tick') }}</DlButton>
    </template>
  </DlSheet>
</template>

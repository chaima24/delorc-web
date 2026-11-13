<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { updateWorkingWeek } from '@/api/tenant/fieldSetup'
import { fieldErrors } from '@/api/errors'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useToast } from '@/composables/useToast'

/**
 * The lab's working week: which days are the weekend (mockup lab-mockups/WorkingWeek.html).
 * Days are Carbon numbers, 0 = Sunday … 6 = Saturday, shown Monday first. 1 to 3 weekend days.
 */
const props = defineProps<{ weekend: number[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [weekend: number[]] }>()

const { t, d } = useI18n()
const toast = useToast()

const WEEK = [1, 2, 3, 4, 5, 6, 0]
// 2026-11-01 is a Sunday: day 0 + n is that weekday's name in the page's language.
const dayName = (day: number) => d(new Date(2026, 10, 1 + day, 12), { weekday: 'long' })

const chosen = ref<number[]>([...props.weekend])
const error = ref('')
const saving = ref(false)

function toggle(day: number): void {
  chosen.value = chosen.value.includes(day) ? chosen.value.filter((value) => value !== day) : [...chosen.value, day]
}

const working = computed(() => WEEK.filter((day) => !chosen.value.includes(day)))
const valid = computed(() => chosen.value.length >= 1 && chosen.value.length <= 3)

async function save(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    const week = await updateWorkingWeek(chosen.value)
    toast.success(t('studio.list.toast.saved'))
    emit('saved', week.weekend_days)
    open.value = false
  } catch (failure) {
    error.value = Object.values(fieldErrors(failure))[0] ?? ''
    if (!error.value) toast.error(t('studio.list.toast.failed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('workingWeek.title')" :description="t('workingWeek.text')">
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap gap-2" role="group" :aria-label="t('workingWeek.title')">
        <button
          v-for="day in WEEK"
          :key="day"
          type="button"
          :aria-pressed="chosen.includes(day)"
          class="h-[38px] rounded-xl border px-3.5 text-sm font-semibold capitalize transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
          :class="chosen.includes(day) ? 'border-dl-ink bg-dl-ink text-dl-mist' : 'border-dl-line text-dl-body hover:bg-dl-line-soft'"
          @click="toggle(day)"
        >
          {{ dayName(day) }}
        </button>
      </div>
      <p class="rounded-2xl bg-dl-mist px-3.5 py-3 text-[13.5px]">
        {{ t('workingWeek.working') }} <b>{{ working.map(dayName).join(', ') }}</b> ({{ t('workingWeek.days', working.length) }})
      </p>
      <p v-if="!valid" class="text-xs text-dl-rejected">{{ t('workingWeek.range') }}</p>
      <p v-else-if="error" class="text-xs text-dl-rejected">{{ error }}</p>
      <p class="text-[12.5px] leading-relaxed text-dl-muted">{{ t('workingWeek.hint') }}</p>
    </div>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton variant="primary" :loading="saving" :disabled="!valid" class="ms-auto" @click="save">{{ t('common.actions.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>

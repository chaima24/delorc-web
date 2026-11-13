<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ActivityCalendar } from '@/api/tenant/activities'
import DlAvatar from '@/components/DlAvatar.vue'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

// Team calendar: people × working days of the month. Each box shows the kind of day; half a day
// is half filled. A click opens the activity behind it.
defineProps<{ calendar: ActivityCalendar }>()
const emit = defineEmits<{ open: [activityId: number] }>()
const { t, d } = useI18n()

const weekday = (iso: string) => d(new Date(`${iso}T12:00:00`), { weekday: 'narrow' })
const COLOR = { off: 'bg-dl-cobalt/35', non: 'bg-dl-pending/35', field: 'bg-dl-signal/40' } as const
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="overflow-x-auto">
      <table class="w-full border-separate border-spacing-[3px] text-[11px]">
        <thead>
          <tr>
            <th class="sticky start-0 min-w-40 bg-dl-paper" />
            <th v-for="day in calendar.days" :key="day" class="min-w-7 text-center font-normal text-dl-muted">
              {{ weekday(day) }}<b class="block text-xs text-dl-fg">{{ Number(day.slice(8)) }}</b>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="person in calendar.people" :key="person.id">
            <th class="sticky start-0 bg-dl-paper pe-2 text-start font-normal">
              <span class="flex items-center gap-2">
                <DlAvatar :name="person.full_name" size="sm" />
                <span class="flex min-w-0 flex-col"><strong class="truncate text-[13px] font-semibold">{{ person.full_name }}</strong><span class="text-[11px] text-dl-muted">{{ roleLabel(person.role) }}</span></span>
              </span>
            </th>
            <td v-for="day in calendar.days" :key="day" class="p-0">
              <button
                v-if="person.days[day]"
                type="button"
                class="relative block h-8 w-full overflow-hidden rounded-[7px] bg-dl-mist focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
                :aria-label="`${person.full_name} · ${day} · ${t(`activities.kind.${person.days[day].kind}`)}`"
                @click="emit('open', person.days[day].activity_ids[0]!)"
              >
                <span class="absolute inset-y-0 start-0" :class="COLOR[person.days[day].kind]" :style="{ width: person.days[day].kind === 'field' || person.days[day].weight >= 1 ? '100%' : '50%' }" />
              </button>
              <span v-else class="block h-8 rounded-[7px] bg-dl-mist" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!calendar.people.length" class="py-6 text-center text-[13px] text-dl-muted">{{ t('activities.empty') }}</p>
    <div class="flex flex-wrap gap-4 text-xs text-dl-muted">
      <span v-for="kind in ['off', 'non', 'field'] as const" :key="kind" class="flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded" :class="COLOR[kind]" />{{ t(`activities.kind.${kind}`) }}</span>
      <span class="flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded bg-[linear-gradient(90deg,rgb(var(--dl-cobalt)/.35)_50%,rgb(var(--dl-mist))_50%)]" />{{ t('activities.calendar.half') }}</span>
      <span>{{ t('activities.calendar.hint') }}</span>
    </div>
  </div>
</template>

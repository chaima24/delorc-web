<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ActivityLine } from '@/api/central/activityLog'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useAccessLabels } from '@/composables/useAccessLabels'
import { dayOf } from './activity'
import ActivityAvatar from './ActivityAvatar.vue'
import { useActivityTexts } from './useActivityTexts'

const props = defineProps<{ line: ActivityLine }>()
const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const { roleLabel } = useAccessLabels()
const { dayLabel, fieldLabel, recordLink, recordName, timeLabel, valueLabel } = useActivityTexts()

const link = computed(() => recordLink(props.line))
const when = computed(() => `${dayLabel(dayOf(new Date(props.line.created_at)))} ${timeLabel(props.line)}`)
const authorName = computed(() => {
  if (props.line.author.type === 'person') return props.line.author.name

  return t(props.line.author.type === 'system' ? 'central.activity.system' : 'central.activity.nobody')
})
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t(`central.activity.title.${line.record_type}.${line.action}`)">
    <template #media><ActivityAvatar :author="line.author" /></template>
    <template #badges>
      <div class="flex flex-wrap gap-1.5">
        <DlBadge size="sm">{{ when }}</DlBadge>
        <DlBadge size="sm">{{ authorName }}</DlBadge>
        <DlBadge v-if="line.author.role" size="sm">{{ t('central.activity.roleAtTheTime', { role: roleLabel(line.author.role) }) }}</DlBadge>
      </div>
    </template>

    <div class="flex flex-col gap-3">
      <section v-if="line.record" class="rounded-2xl border border-dl-line">
        <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
          <h3 class="flex-1 text-sm font-semibold">{{ t('central.activity.record') }}</h3>
          <DlButton v-if="link" variant="outline" size="sm" icon="tabler-external-link" :to="link">{{ t('central.activity.open') }}</DlButton>
        </header>
        <p class="px-3.5 pb-3 text-[13px] text-dl-body">
          {{ t(`central.activity.recordType.${line.record_type}`) }} <strong class="text-dl-fg">{{ recordName(line) }}</strong>
        </p>
      </section>

      <section v-if="line.changes.length" class="rounded-2xl border border-dl-line">
        <h3 class="px-3.5 pb-1.5 pt-3 text-sm font-semibold">{{ t('central.activity.whatChanged') }}</h3>
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr class="text-xs text-dl-muted">
              <th class="px-3.5 py-1.5 text-start font-semibold">{{ t('central.activity.field.label') }}</th>
              <th class="px-3.5 py-1.5 text-start font-semibold">{{ t('central.activity.before') }}</th>
              <th class="px-3.5 py-1.5 text-start font-semibold">{{ t('central.activity.after') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="change in line.changes" :key="change.field" class="border-t border-dl-line-soft">
              <td class="px-3.5 py-2">{{ fieldLabel(line, change.field) }}</td>
              <td class="px-3.5 py-2 text-dl-rejected line-through">{{ valueLabel(line, change.field, change.before) }}</td>
              <td class="px-3.5 py-2 font-semibold">{{ valueLabel(line, change.field, change.after) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="line.attempt" class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px] text-dl-body">
        <h3 class="mb-1.5 text-sm font-semibold text-dl-fg">{{ t('central.activity.attempt') }}</h3>
        {{ t('central.activity.emailTyped') }}: <strong class="text-dl-fg">{{ line.attempt.email }}</strong><br>
        {{ t('central.activity.stepLabel') }}: {{ t(`central.activity.step.${line.attempt.step}`) }}<br>
        {{ t('central.activity.reasonLabel') }}: {{ t(`central.activity.reason.${line.attempt.reason}`) }}<br>
        {{ t('central.activity.ip') }}: {{ line.attempt.ip ?? '—' }}
      </section>

      <section v-if="line.import" class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px]">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('central.translations.lastImport') }}</h3>
        <p v-for="(count, name) in line.import" :key="name" class="flex justify-between py-1">
          <span>{{ t(`central.translations.result.${name}`) }}</span><strong class="tabular-nums">{{ count }}</strong>
        </p>
      </section>

      <p v-if="line.attempt" class="text-xs text-dl-muted">{{ t('central.activity.typedNeverSaved') }}</p>
      <p v-if="line.action === 'second_factor_reset'" class="text-xs text-dl-muted">{{ t('central.activity.secretsNeverLogged') }}</p>
      <p class="text-xs text-dl-muted">{{ t('central.activity.readOnly') }}</p>
    </div>
  </DlRecordPanel>
</template>

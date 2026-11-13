<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CoachingFamily } from '@/api/tenant/coaching'

// The grid's families with their sections, as check boxes. Checking a family checks all its sections;
// only sections are sent.
defineProps<{ families: CoachingFamily[]; error?: string }>()
const ids = defineModel<number[]>({ required: true })
const { t } = useI18n()

const sectionIds = (family: CoachingFamily) => family.sections.map(section => section.id)
const allIn = (family: CoachingFamily) => family.sections.length > 0 && sectionIds(family).every(id => ids.value.includes(id))
const someIn = (family: CoachingFamily) => sectionIds(family).some(id => ids.value.includes(id))
function toggleFamily(family: CoachingFamily) {
  const own = sectionIds(family)
  ids.value = allIn(family) ? ids.value.filter(id => !own.includes(id)) : [...new Set([...ids.value, ...own])]
}
const toggle = (id: number) => { ids.value = ids.value.includes(id) ? ids.value.filter(row => row !== id) : [...ids.value, id] }
</script>

<template>
  <fieldset class="flex flex-col gap-1">
    <legend class="mb-1.5 text-[13px] font-semibold">{{ t('coaching.fields.sections') }}</legend>
    <p v-if="!families.length" class="text-[13px] text-dl-muted">{{ t('coaching.grid.emptyText') }}</p>
    <template v-for="family in families" :key="family.id">
      <label class="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm font-bold hover:bg-dl-line-soft">
        <input type="checkbox" class="h-[18px] w-[18px] accent-dl-ink" :checked="allIn(family)" :indeterminate="!allIn(family) && someIn(family)" :disabled="!family.sections.length" @change="toggleFamily(family)">
        <span class="flex-1">{{ family.name }}</span>
        <small class="text-xs font-normal text-dl-muted">{{ t('coaching.grid.sectionsCount', family.sections.length) }}</small>
      </label>
      <label v-for="section in family.sections" :key="section.id" class="flex cursor-pointer items-center gap-2.5 rounded-xl py-1.5 ps-8 pe-2 text-sm hover:bg-dl-line-soft">
        <input type="checkbox" class="h-[18px] w-[18px] accent-dl-ink" :checked="ids.includes(section.id)" @change="toggle(section.id)">
        <span class="flex-1">{{ section.name }}</span>
        <small class="text-xs text-dl-muted">{{ t('coaching.grid.activeCount', section.active_count) }}</small>
      </label>
    </template>
    <p v-if="error" class="text-xs text-dl-rejected">{{ error }}</p>
  </fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import { useTerritories } from './useTerritoryLookups'

export interface TerritoryDetailsForm {
  name: string
  parent_id: number | null
  sector: string
  description: string
}

// Name, part of (not itself or one under it), sector, description.
const props = defineProps<{ errors: Record<string, string>; selfId?: number }>()
const form = defineModel<TerritoryDetailsForm>('form', { required: true })
const { t } = useI18n()
const territories = useTerritories()
territories.ensureLoaded()

/** Itself and every territory under it can't be its parent. */
const excluded = computed(() => {
  const ids = new Set<number>(props.selfId ? [props.selfId] : [])
  let grew = true
  while (grew) {
    grew = false
    for (const item of territories.items.value) {
      if (item.parent_id != null && ids.has(item.parent_id) && !ids.has(item.id)) {
        ids.add(item.id)
        grew = true
      }
    }
  }
  return ids
})
const parentOptions = computed(() => territories.items.value
  .filter(item => !excluded.value.has(item.id))
  .map(item => ({ value: item.id, label: item.name, hint: item.parent?.name }))
  .sort((a, b) => a.label.localeCompare(b.label)))
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <DlInput v-model="form.name" :label="t('territories.fields.name')" :error="errors.name" />
    <DlCombobox v-model="form.parent_id" :label="`${t('territories.fields.parent')} · ${t('territories.fields.optional')}`" :options="parentOptions" :hint="t('territories.fields.parentHint')" :error="errors.parent_id" />
    <DlInput v-model="form.sector" :label="`${t('territories.fields.sector')} · ${t('territories.fields.optional')}`" :placeholder="t('territories.fields.sectorPlaceholder')" :error="errors.sector" />
    <label class="flex flex-col gap-1.5">
      <span class="text-[13px] font-semibold">{{ t('territories.fields.description') }} · {{ t('territories.fields.optional') }}</span>
      <textarea v-model="form.description" rows="3" class="rounded-xl border border-dl-line bg-dl-paper px-3.5 py-2.5 text-sm outline-hidden focus:ring-2 focus:ring-dl-cobalt" />
      <span v-if="errors.description" class="text-xs text-dl-rejected">{{ errors.description }}</span>
    </label>
  </div>
</template>

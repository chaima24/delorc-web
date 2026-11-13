<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'

// The teams (or the specialities) an ADV is given to: pick one to add a line, each line has optional dates.
export interface AudienceRow { id: number; start_date: string; end_date: string }

const props = defineProps<{
  title: string
  addLabel: string
  options: { value: number; label: string }[]
  /** Errors keyed `N.end_date`. */
  errors?: Record<string, string>
}>()
const rows = defineModel<AudienceRow[]>({ required: true })
const { t } = useI18n()

const left = computed(() => props.options.filter(option => !rows.value.some(row => row.id === option.value)))
const nameOf = (id: number) => props.options.find(option => option.value === id)?.label ?? `#${id}`
const picked = computed({
  get: () => null as number | null,
  set: value => { if (value != null) rows.value = [...rows.value, { id: Number(value), start_date: '', end_date: '' }] },
})
const remove = (id: number) => { rows.value = rows.value.filter(row => row.id !== id) }
</script>

<template>
  <fieldset class="flex flex-col gap-2.5 rounded-2xl border border-dl-line p-3.5">
    <legend class="px-1 text-sm font-bold">{{ title }}</legend>
    <div v-for="(row, i) in rows" :key="row.id" class="flex flex-col gap-1.5">
      <div class="flex items-center gap-2">
        <strong class="min-w-0 flex-1 truncate text-[13px] font-semibold">{{ nameOf(row.id) }}</strong>
        <DlIconButton icon="tabler-x" variant="ghost" :size="32" :label="t('advs.audience.remove', { name: nameOf(row.id) })" @click="remove(row.id)" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <DlInput v-model="row.start_date" type="date" :label="t('advs.audience.start')" />
        <DlInput v-model="row.end_date" type="date" :label="t('advs.audience.end')" :error="errors?.[`${i}.end_date`]" />
      </div>
    </div>
    <p v-if="!rows.length" class="text-[13px] text-dl-muted">{{ t('advs.audience.none') }}</p>
    <DlSelect v-if="left.length" v-model="picked" :label="addLabel" :options="left" :placeholder="addLabel" hide-label />
  </fieldset>
</template>

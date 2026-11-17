<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DlCombobox from '@/components/DlCombobox.vue'
import DlIconButton from '@/components/DlIconButton.vue'

/** Pick several items: a full-width search select, each item picked becomes a chip with ✕. */
const props = defineProps<{
  legend: string
  selectedLabel: string
  searchLabel: string
  items: { value: number; label: string; hint?: string }[]
  emptyText: string
  disabled?: boolean
  error?: string
}>()

const model = defineModel<number[]>({ required: true })
const { t } = useI18n()

const options = computed(() => props.items.filter(item => !model.value.includes(item.value)))
const picked = computed({
  get: () => null as number | null,
  set: value => { if (value != null) model.value = [...model.value, Number(value)] },
})
const chosen = computed(() => model.value.map(value => props.items.find(item => item.value === value)).filter(item => item !== undefined))
const remove = (value: number) => { model.value = model.value.filter(v => v !== value) }
</script>

<template>
  <fieldset class="flex flex-col gap-2.5">
    <legend class="mb-1 flex w-full items-baseline justify-between text-[13px] font-semibold">
      {{ legend }}
      <span class="font-normal text-dl-muted">{{ selectedLabel }}</span>
    </legend>
    <p v-if="!items.length" class="text-sm text-dl-muted">{{ emptyText }}</p>
    <DlCombobox v-else-if="!disabled" v-model="picked" :label="searchLabel" :placeholder="searchLabel" :options="options" hide-label />
    <div v-if="chosen.length" class="flex flex-wrap gap-1.5">
      <span v-for="item in chosen" :key="item.value" class="inline-flex items-center gap-1 rounded-full bg-dl-line-soft py-0.5 text-xs font-semibold" :class="disabled ? 'px-3' : 'ps-3 pe-0.5'">
        {{ item.label }}
        <span v-if="item.hint" class="font-normal text-dl-pending">· {{ item.hint }}</span>
        <DlIconButton v-if="!disabled" icon="tabler-x" variant="ghost" :size="26" :label="t('coaching.picks.remove', { name: item.label })" @click="remove(item.value)" />
      </span>
    </div>
    <p v-if="error" class="text-xs text-dl-rejected">{{ error }}</p>
  </fieldset>
</template>

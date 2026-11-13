<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DlIconButton from '@/components/DlIconButton.vue'
import DlSelect from '@/components/DlSelect.vue'

// Several roles: each picked role is a chip with ✕; the select below adds one more.
const props = defineProps<{
  label: string
  options: { value: number; label: string }[]
  error?: string
}>()
const ids = defineModel<number[]>({ required: true })
const { t } = useI18n()

const left = computed(() => props.options.filter(option => !ids.value.includes(option.value)))
const nameOf = (id: number) => props.options.find(option => option.value === id)?.label ?? `#${id}`
const picked = computed({
  get: () => null as number | null,
  set: value => { if (value != null) ids.value = [...ids.value, Number(value)] },
})
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-1.5 text-[13px] font-semibold">{{ label }}</legend>
    <div v-if="ids.length" class="flex flex-wrap gap-1.5">
      <span v-for="id in ids" :key="id" class="inline-flex items-center gap-1 rounded-full bg-dl-line-soft py-0.5 ps-3 pe-0.5 text-xs font-semibold">
        {{ nameOf(id) }}
        <DlIconButton icon="tabler-x" variant="ghost" :size="26" :label="t('coaching.picks.remove', { name: nameOf(id) })" @click="ids = ids.filter(row => row !== id)" />
      </span>
    </div>
    <DlSelect v-if="left.length" v-model="picked" :label="t('coaching.picks.add')" :options="left" :placeholder="t('coaching.picks.add')" hide-label />
    <p v-if="error" class="text-xs text-dl-rejected">{{ error }}</p>
  </fieldset>
</template>

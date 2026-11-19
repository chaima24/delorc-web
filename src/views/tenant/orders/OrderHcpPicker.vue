<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchHcps } from '@/api/tenant/hcps'
import DlCombobox from '@/components/DlCombobox.vue'

// A buyer or a supplier: professionals of some types, searched on the server (a lab may hold thousands).
const props = defineProps<{ label: string; types: string[]; error?: string; disabled?: boolean; initial?: { id: number; name: string } | null }>()
const model = defineModel<number | null>({ default: null })
const emit = defineEmits<{ picked: [hcp: { id: number; name: string; type: string }] }>()
const { t } = useI18n()

const search = ref('')
const found = ref<{ id: number; name: string; type: string; hint: string }[]>(props.initial ? [{ ...props.initial, type: '', hint: '' }] : [])
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, value => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const { items } = await fetchHcps({ 'filter[q]': value.trim() || undefined, 'filter[type]': props.types.join(','), 'filter[status]': 'active', per_page: 10, sort: 'name' })
    const chosen = found.value.find(row => row.id === model.value)
    const rows = items.map(row => ({ id: row.id, name: row.name, type: row.type ?? '', hint: [t(`hcps.types.${row.type}`), row.commune?.name].filter(Boolean).join(' · ') }))
    found.value = chosen && !rows.some(row => row.id === chosen.id) ? [chosen, ...rows] : rows
  }, 250)
}, { immediate: true })
const options = computed(() => found.value.map(row => ({ value: row.id, label: row.name, hint: row.hint })))
const picked = computed({
  get: () => model.value,
  set: value => {
    model.value = value == null ? null : Number(value)
    const row = found.value.find(item => item.id === model.value)
    if (row) emit('picked', row)
  },
})
</script>

<template>
  <DlCombobox v-model="picked" v-model:search="search" :label="label" :placeholder="t('orders.form.searchHcp')" :options="options" :error="error" :disabled="disabled" />
</template>

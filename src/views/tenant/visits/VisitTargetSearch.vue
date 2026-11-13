<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchHcos } from '@/api/tenant/hcos'
import { fetchHcps } from '@/api/tenant/hcps'
import DlInput from '@/components/DlInput.vue'

export interface FoundTarget {
  id: number
  name: string
  /** "Kouba", shown under the name. */
  hint: string
  /** doctor, pharmacie… (professionals) or hospital, clinic (organisations). */
  kind: string | null
}

// Finds a professional or an organisation by name: type, wait a moment, pick a line. The API searches (the lab
// may hold thousands of them).
const props = defineProps<{ type: 'hcp' | 'hco'; label: string; error?: string }>()
const emit = defineEmits<{ pick: [target: FoundTarget] }>()
const { t } = useI18n()
const term = ref('')
const results = ref<FoundTarget[]>([])
const searched = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

watch([term, () => props.type], () => {
  clearTimeout(timer)
  searched.value = false
  if (term.value.trim().length < 2) {
    results.value = []
    return
  }
  timer = setTimeout(async () => {
    const params = { 'filter[q]': term.value.trim(), per_page: 8, sort: 'name' }
    const rows = props.type === 'hco' ? (await fetchHcos(params)).items : (await fetchHcps({ ...params, 'filter[status]': 'active' })).items
    results.value = rows.map(row => ({ id: row.id, name: row.name, hint: row.commune?.name ?? '', kind: row.type ?? null }))
    searched.value = true
  }, 300)
})

function pick(target: FoundTarget) {
  term.value = ''
  results.value = []
  emit('pick', target)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <DlInput v-model="term" type="search" icon="tabler-search" :label="label" :placeholder="t('visits.search.placeholder')" :error="error" hide-label />
    <ul v-if="results.length" class="flex flex-col rounded-xl border border-dl-line">
      <li v-for="row in results" :key="row.id" class="border-b border-dl-line-soft last:border-0">
        <button type="button" class="flex w-full flex-col px-3 py-2 text-start text-[13.5px] hover:bg-dl-mist focus-visible:bg-dl-mist focus-visible:outline-hidden" @click="pick(row)">
          <strong class="font-semibold">{{ row.name }}</strong>
          <small v-if="row.hint" class="text-xs text-dl-muted">{{ row.hint }}</small>
        </button>
      </li>
    </ul>
    <p v-else-if="searched" class="text-xs text-dl-muted">{{ t('common.search.noMatch') }}</p>
  </div>
</template>

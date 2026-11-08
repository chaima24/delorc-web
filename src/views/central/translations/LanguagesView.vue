<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { languagesApi, type Language } from '@/api/central/languages'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import { sortRows } from '@/composables/sortRows'
import { useAuthStore } from '@/stores/auth'
import AddLanguagePanel from './AddLanguagePanel.vue'
import LanguagePanel from './LanguagePanel.vue'
import TranslationTabs from './TranslationTabs.vue'
import { useLanguageName } from './useLanguageName'

const { t, d, n } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const languageName = useLanguageName()

const languages = ref<Language[]>([])
const search = ref('')
const status = ref('all')
const sort = ref('-created_at')
const selectedCode = ref<string | null>(null)
const adding = ref(false)
const error = ref<string | null>(null)

const selected = computed(() => languages.value.find(({ code }) => code === selectedCode.value) ?? null)
const panelOpen = computed({
  get: () => selected.value !== null,
  set: (open) => {
    if (!open) selectedCode.value = null
  },
})
const wide = computed(() => (panelOpen.value || adding.value ? 'hidden' : 'hidden lg:table-cell'))
const totalTexts = computed(() => (languages.value[0] ? languages.value[0].texts_done + languages.value[0].texts_missing : 0))
const statusOptions = computed(() => [
  { value: 'all', label: t('common.list.all') },
  { value: 'active', label: t('central.languages.status.active') },
  { value: 'inactive', label: t('central.languages.status.inactive') },
])

const nameOf = (code: string | null) => {
  if (!code) return '—'

  return languageName(code, languages.value.find((item) => item.code === code)?.name)
}

// Few languages, all loaded: the page searches and sorts them itself.
const shown = computed(() => {
  const text = search.value.trim().toLowerCase()
  const found = languages.value.filter((language) => {
    const matches = [nameOf(language.code), language.name, language.native_name, language.code].some((value) => value.toLowerCase().includes(text))

    return matches && (status.value === 'all' || language.is_active === (status.value === 'active'))
  })

  return sortRows(found, sort.value, {
    name: (language) => nameOf(language.code),
    direction: (language) => language.direction,
    locale: (language) => language.locale,
    percent_done: (language) => language.percent_done,
    is_active: (language) => Number(language.is_active),
    created_at: (language) => language.created_at,
  })
})

async function load(): Promise<void> {
  error.value = null
  try {
    languages.value = await languagesApi.list()
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
}

onMounted(async () => {
  await load()
  // The activity log links here with ?open={id}.
  selectedCode.value = languages.value.find(({ id }) => String(id) === route.query.open)?.code ?? null
})

function open(language: Language): void {
  adding.value = false
  selectedCode.value = language.code
}

function startAdding(): void {
  selectedCode.value = null
  adding.value = true
}

async function onAdded(language: Language): Promise<void> {
  adding.value = false
  await load()
  selectedCode.value = language.code
}

function onDeleted(): void {
  selectedCode.value = null
  load()
}
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex items-end justify-between gap-3">
        <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.languages.title') }}</h1>
        <DlButton v-if="auth.can('languages.create')" variant="primary" icon="tabler-plus" @click="startAdding">{{ t('central.languages.add') }}</DlButton>
      </div>
      <TranslationTabs :texts="totalTexts" :languages="languages.length" />
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <div class="overflow-x-auto rounded-3xl bg-dl-paper p-4">
        <div class="mb-3 flex flex-wrap gap-2.5">
          <DlInput v-model="search" :label="t('central.languages.search')" :placeholder="t('central.languages.search')" hide-label icon="tabler-search" class="w-full sm:w-60" />
          <DlSelect v-model="status" :label="t('central.languages.statusLabel')" :options="statusOptions" appearance="filter" />
        </div>

        <DlEmptyState v-if="languages.length && !shown.length" :title="t('central.languages.empty')" icon="tabler-language" />
        <table v-else class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-dl-line text-xs text-dl-muted">
              <DlSortHeader v-model="sort" column="name" :label="t('central.languages.language')" />
              <DlSortHeader v-model="sort" column="direction" :label="t('central.languages.directionLabel')" :class="wide" />
              <DlSortHeader v-model="sort" column="locale" :label="t('central.languages.locale')" :class="wide" />
              <DlSortHeader v-model="sort" column="percent_done" :label="t('central.languages.done')" />
              <DlSortHeader v-model="sort" column="is_active" :label="t('central.languages.statusLabel')" />
              <DlSortHeader v-model="sort" column="created_at" :label="t('common.list.createdAt')" :class="wide" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="language in shown"
              :key="language.code"
              class="cursor-pointer border-b border-dl-line-soft hover:bg-dl-line-soft"
              :class="selected?.code === language.code && 'bg-dl-signal-soft'"
              tabindex="0"
              @click="open(language)"
              @keydown.enter="open(language)"
            >
              <td class="p-3">
                <strong class="block">{{ nameOf(language.code) }}</strong>
                <small class="block text-xs text-dl-muted"><span :dir="language.direction">{{ language.native_name }}</span> · {{ language.code }}</small>
              </td>
              <td class="p-3 text-[13px] text-dl-muted" :class="wide">{{ t(`central.languages.direction.${language.direction}`) }}</td>
              <td class="p-3 text-[13px] text-dl-muted" :class="wide">{{ language.locale }}</td>
              <td class="p-3 text-[13px] tabular-nums text-dl-muted">{{ n(language.percent_done) }}%</td>
              <td class="p-3"><DlBadge :tone="language.is_active ? 'success' : 'neutral'" dot>{{ t(`central.languages.status.${language.is_active ? 'active' : 'inactive'}`) }}</DlBadge></td>
              <td class="p-3 text-[13px] text-dl-muted" :class="wide">{{ d(new Date(language.created_at)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <LanguagePanel v-if="selected" v-model:open="panelOpen" :language="selected" :languages="languages" @changed="load" @deleted="onDeleted" />
    <AddLanguagePanel v-if="adding" v-model:open="adding" :texts="totalTexts" @added="onAdded" />
  </div>
</template>

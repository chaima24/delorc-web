<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { languagesApi, type Language } from '@/api/central/languages'
import { translationsApi, type TextRow, type TextSummary, type TextToSave } from '@/api/central/translations'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useAuthStore } from '@/stores/auth'
import ImportExportPanel from './ImportExportPanel.vue'
import TextPanel from './TextPanel.vue'
import TranslationTabs from './TranslationTabs.vue'
import { useLanguageName } from './useLanguageName'

const { t, n } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const languageName = useLanguageName()

const languages = ref<Language[]>([])
const rows = ref<TextRow[]>([])
const summary = ref<TextSummary | null>(null)
const total = ref(0)
const page = ref(1)
const perPage = ref(25)
const search = ref('')
// The Languages page links here with ?language=ar&state=missing.
const language = ref<string | number>(String(route.query.language ?? 'all'))
const usedIn = ref('all')
const state = ref(String(route.query.state ?? 'all'))
const sort = ref('key')
const loading = ref(true)
const error = ref<string | null>(null)

/** Texts typed and not saved yet, by key. They stay when the page or the filters change. */
const edits = ref<Record<string, string>>({})
const rowErrors = ref<Record<string, string>>({})
const saving = ref(false)

const selectedKey = ref<string | null>(null)
const showingFiles = ref(false)

const panelOpen = computed({
  get: () => selectedKey.value !== null,
  set: (open) => {
    if (!open) selectedKey.value = null
  },
})

const chosen = computed(() => languages.value.find((item) => item.code === language.value) ?? null)
const canEdit = computed(() => auth.can('translations.update'))
const canUseFiles = computed(() => auth.can('translations.export') || auth.can('translations.import'))
const changes = computed(() => Object.keys(edits.value).length)
const columns = computed(() => (languages.value.length ? languages.value.map(({ code }) => code) : Object.keys(rows.value[0]?.texts ?? {})))
const nameOf = (code: string) => languageName(code, languages.value.find((item) => item.code === code)?.name)

const all = computed(() => ({ value: 'all', label: t('common.list.all') }))
// French is edited in the key panel: here it is the reference column.
const languageOptions = computed(() => [
  all.value,
  ...languages.value.filter(({ code }) => code !== 'fr').map(({ code, name }) => ({ value: code, label: languageName(code, name) })),
])
const usedInOptions = computed(() => [all.value, ...['web', 'api', 'mail'].map((value) => ({ value, label: t(`central.translations.usedIn.${value}`) }))])
const stateOptions = computed(() => [all.value, ...['missing', 'check', 'done'].map((value) => ({ value, label: t(`central.translations.state.${value}`) }))])

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const answer = await translationsApi.list({
      language: language.value === 'all' ? undefined : String(language.value),
      search: search.value || undefined,
      used_in: usedIn.value === 'all' ? undefined : usedIn.value,
      state: state.value === 'all' ? undefined : state.value,
      sort: sort.value,
    }, page.value, perPage.value)
    rows.value = answer.data
    total.value = answer.meta.total
    summary.value = answer.summary
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    loading.value = false
  }
}

function reloadFromFirstPage(): void {
  if (page.value === 1) load()
  else page.value = 1
}

let typing: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(typing)
  typing = setTimeout(reloadFromFirstPage, 300)
})
watch(language, () => {
  // The other language's column no longer exists.
  if (!['key', '-key', 'fr', '-fr'].includes(sort.value)) sort.value = 'key'
  reloadFromFirstPage()
})
watch([usedIn, state, sort, perPage], reloadFromFirstPage)
watch(page, load)

async function loadLanguages(): Promise<void> {
  if (auth.can('languages.show')) languages.value = await languagesApi.list().catch(() => [])
}

onMounted(() => {
  load()
  loadLanguages()
})

function textOf(row: TextRow): string {
  return edits.value[row.key] ?? row.value ?? ''
}

function edit(row: TextRow, value: string): void {
  const others = { ...edits.value }
  delete others[row.key]
  edits.value = value === (row.value ?? '') ? others : { ...others, [row.key]: value }
  delete rowErrors.value[row.key]
}

function undo(): void {
  edits.value = {}
  rowErrors.value = {}
}

async function save(): Promise<void> {
  const texts: TextToSave[] = Object.entries(edits.value).map(([key, value]) => ({ language: String(language.value), key, value: value || null }))
  saving.value = true
  rowErrors.value = {}
  error.value = null
  try {
    await translationsApi.save(texts)
    undo()
    load()
    loadLanguages()
  } catch (failure) {
    const fields = fieldErrors(failure)
    rowErrors.value = Object.fromEntries(texts.flatMap((text, index) => {
      const message = fields[`texts.${index}.value`]

      return message ? [[text.key, message]] : []
    }))
    if (!Object.keys(rowErrors.value).length) error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    saving.value = false
  }
}

function openKey(key: string): void {
  showingFiles.value = false
  selectedKey.value = key
}

function openFiles(): void {
  selectedKey.value = null
  showingFiles.value = true
}

function onChanged(): void {
  load()
  loadLanguages()
}
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex items-end justify-between gap-3">
        <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.translations.texts') }}</h1>
        <DlButton v-if="canUseFiles" variant="outline" @click="openFiles">{{ t('central.translations.importExport') }}</DlButton>
      </div>
      <TranslationTabs :texts="summary?.total" :languages="languages.length || undefined" />
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <div class="rounded-3xl bg-dl-paper p-4">
        <div class="mb-3 flex flex-wrap items-center gap-2.5">
          <DlSelect v-if="languages.length" v-model="language" :label="t('central.translations.language')" :options="languageOptions" :disabled="changes > 0" appearance="filter" />
          <DlInput v-model="search" :label="t('central.translations.search')" :placeholder="t('central.translations.search')" hide-label icon="tabler-search" class="w-full sm:w-60" />
          <DlSelect v-model="usedIn" :label="t('central.translations.usedInLabel')" :options="usedInOptions" appearance="filter" />
          <DlSelect v-model="state" :label="t('central.translations.show')" :options="stateOptions" appearance="filter" />
          <span v-if="summary" class="ms-auto flex items-center gap-2 text-[13px] text-dl-muted">
            <span class="block h-2 w-28 overflow-hidden rounded-full bg-dl-line-soft"><span class="block h-full rounded-full bg-dl-cobalt" :style="{ width: `${summary.percent_done}%` }" /></span>
            {{ t('central.translations.progress', { percent: n(summary.percent_done), missing: n(summary.missing) }) }}
          </span>
        </div>

        <DlEmptyState v-if="!loading && !rows.length" :title="t('central.translations.empty')" icon="tabler-language" />
        <div v-else class="overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-dl-line text-xs text-dl-muted">
                <DlSortHeader v-model="sort" column="key" :label="t('central.translations.key')" />
                <template v-if="chosen">
                  <DlSortHeader v-model="sort" column="fr" :label="t('central.translations.reference')" />
                  <DlSortHeader v-model="sort" :column="chosen.code" :label="nameOf(chosen.code)" />
                </template>
                <template v-else>
                  <DlSortHeader
                    v-for="code in columns"
                    :key="code"
                    v-model="sort"
                    :column="code"
                    :label="code === 'fr' ? t('central.translations.reference') : nameOf(code)"
                  />
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.key" class="border-b border-dl-line-soft align-top" :class="selectedKey === row.key && 'bg-dl-signal-soft'">
                <td class="p-3">
                  <button type="button" class="text-start font-mono text-[12.5px] text-dl-body hover:text-dl-cobalt focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt" @click="openKey(row.key)">{{ row.key }}</button>
                </td>
                <template v-if="chosen">
                  <td class="p-3">{{ row.reference }}</td>
                  <td class="min-w-56 p-3">
                    <DlTextarea
                      v-if="canEdit"
                      :model-value="textOf(row)"
                      :label="`${nameOf(chosen.code)}: ${row.key}`"
                      hide-label
                      :dir="chosen.direction"
                      :placeholder="t('central.translations.missingShows', { text: row.shown ?? '' })"
                      :changed="row.key in edits"
                      :error="rowErrors[row.key]"
                      @update:model-value="edit(row, $event)"
                    />
                    <span v-else-if="row.value" :dir="chosen.direction">{{ row.value }}</span>
                    <span v-else class="text-xs text-dl-muted">{{ t('central.translations.state.missing') }}</span>
                    <p v-if="row.state === 'check' && !(row.key in edits)" class="mt-1 text-xs text-dl-pending">{{ t('central.translations.toCheck') }}</p>
                  </td>
                </template>
                <template v-else>
                  <td v-for="code in columns" :key="code" class="p-3">
                    <span v-if="row.texts?.[code]" :dir="languages.find((item) => item.code === code)?.direction">{{ row.texts[code] }}</span>
                    <span v-else class="text-xs text-dl-muted">{{ t('central.translations.state.missing') }}</span>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

        <div v-if="changes" class="sticky bottom-3 mt-3 flex items-center gap-3 rounded-[18px] bg-dl-ink py-2.5 pe-3 ps-[18px] text-sm text-dl-on-ink">
          <span>{{ t('central.translations.changes', { count: n(changes) }) }}</span>
          <DlButton variant="ghost" size="sm" class="ms-auto text-dl-on-ink! hover:bg-dl-ink-2!" @click="undo">{{ t('central.roles.undo') }}</DlButton>
          <DlButton variant="primary" size="sm" :loading="saving" @click="save">{{ t('central.translations.save') }}</DlButton>
        </div>
      </div>
    </div>

    <TextPanel v-if="selectedKey" v-model:open="panelOpen" :text-key="selectedKey" :languages="languages" @saved="onChanged" />
    <ImportExportPanel v-if="showingFiles" v-model:open="showingFiles" @imported="onChanged" />
  </div>
</template>

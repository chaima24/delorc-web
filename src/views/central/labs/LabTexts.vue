<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { labTextsApi, type Lab, type LabTextRow } from '@/api/central/labs'
import { languagesApi, type Language } from '@/api/central/languages'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useAuthStore } from '@/stores/auth'

/** The lab's own copy of the texts. A saved text is changed for the lab: master fixes leave it alone until it is put back. */
const props = defineProps<{ lab: Lab }>()
const emit = defineEmits<{ changed: [lab: Lab] }>()

const { t, n } = useI18n()
const auth = useAuthStore()
const canEdit = computed(() => auth.can('translations.update'))

const rows = ref<LabTextRow[]>([])
const total = ref(0)
const changedCount = ref(0)
const page = ref(1)
const perPage = ref(25)
const search = ref('')
const language = ref<string>('all')
const onlyChanged = ref(false)
const sort = ref('key')
const loading = ref(true)
const error = ref<string | null>(null)

/** Texts typed and not saved yet, by key, for the chosen language. */
const edits = ref<Record<string, string>>({})
const rowErrors = ref<Record<string, string>>({})
const saving = ref(false)
const puttingBack = ref<string | null>(null)

const languages = computed(() => props.lab.copied_languages)
const chosen = computed(() => languages.value.find(({ code }) => code === language.value) ?? null)
const directionOf = (code: string) => languages.value.find((item) => item.code === code)?.direction
const changes = computed(() => Object.keys(edits.value).length)
const languageOptions = computed(() => [{ value: 'all', label: t('central.labs.texts.allLanguages') }, ...languages.value.map(({ code, native_name }) => ({ value: code, label: native_name }))])

// Active master languages this lab does not have yet: a language reaches a lab only on request.
const master = ref<Language[]>([])
const toAdd = ref<number | null>(null)
const addable = computed(() => master.value.filter((item) => item.is_active && !languages.value.some(({ id }) => id === item.id))
  .map((item) => ({ value: item.id, label: t('central.labs.texts.languageDone', { name: item.native_name, percent: n(item.percent_done) }) })))

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const answer = await labTextsApi.list(props.lab.id, {
      language: chosen.value?.code,
      search: search.value || undefined,
      changed: onlyChanged.value,
      sort: sort.value,
    }, page.value, perPage.value)
    rows.value = answer.data
    total.value = answer.meta.total
    changedCount.value = answer.summary.changed
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
  if (!['key', '-key'].includes(sort.value)) sort.value = 'key'
  reloadFromFirstPage()
})
watch([onlyChanged, sort, perPage], reloadFromFirstPage)
watch(page, load)

onMounted(async () => {
  load()
  if (canEdit.value && auth.can('languages.show')) master.value = await languagesApi.list().catch(() => [])
})

const textOf = (row: LabTextRow) => edits.value[row.key] ?? row.value ?? ''

function edit(row: LabTextRow, value: string): void {
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
  const texts = Object.entries(edits.value).map(([key, value]) => ({ language: chosen.value!.code, key, value: value || null }))
  saving.value = true
  error.value = null
  rowErrors.value = {}
  try {
    await labTextsApi.save(props.lab.id, texts)
    undo()
    load()
  } catch (failure) {
    const fields = fieldErrors(failure)
    rowErrors.value = Object.fromEntries(texts.flatMap((text, index) => {
      const message = fields[`texts.${index}.value`] ?? fields[`texts.${index}.language`]

      return message ? [[text.key, message]] : []
    }))
    if (!Object.keys(rowErrors.value).length) error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    saving.value = false
  }
}

async function putBack(row: LabTextRow): Promise<void> {
  try {
    await labTextsApi.putBack(props.lab.id, chosen.value!.code, row.key)
    puttingBack.value = null
    load()
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
}

async function addLanguage(): Promise<void> {
  if (toAdd.value === null) return
  try {
    emit('changed', await labTextsApi.addLanguage(props.lab.id, toAdd.value))
    toAdd.value = null
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 rounded-3xl bg-dl-paper p-4">
    <div class="flex flex-wrap items-center gap-2 text-[13px]">
      <strong>{{ t('central.labs.texts.languages') }}</strong>
      <DlBadge v-for="item in languages" :key="item.id" size="sm">{{ item.native_name }}<template v-if="item.id === lab.language?.id"> · {{ t('central.labs.texts.default') }}</template></DlBadge>
      <template v-if="canEdit && addable.length">
        <DlSelect v-model="toAdd" :label="t('central.labs.texts.addLanguage')" :options="addable" :placeholder="t('central.labs.texts.addLanguage')" appearance="filter" hide-label class="ms-2" />
        <DlButton v-if="toAdd !== null" variant="outline" size="sm" icon="tabler-plus" @click="addLanguage">{{ t('central.labs.texts.add') }}</DlButton>
      </template>
    </div>
    <DlAlert v-if="error">{{ error }}</DlAlert>

    <div class="flex flex-wrap items-center gap-2.5">
      <DlSelect v-model="language" :label="t('central.translations.language')" :options="languageOptions" :disabled="changes > 0" appearance="filter" />
      <DlInput v-model="search" :label="t('central.translations.search')" :placeholder="t('central.translations.search')" hide-label icon="tabler-search" class="w-full sm:w-60" />
      <DlSwitch v-model="onlyChanged" :label="t('central.labs.texts.onlyChanged')" />
      <span class="ms-auto text-[12.5px] text-dl-muted">{{ t('central.labs.texts.changedCount', { count: changedCount }) }}</span>
    </div>

    <DlEmptyState v-if="!loading && !rows.length" :title="t('central.translations.empty')" icon="tabler-language" />
    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-dl-line text-xs text-dl-muted">
            <DlSortHeader v-model="sort" column="key" :label="t('central.translations.key')" />
            <template v-if="chosen">
              <DlSortHeader v-model="sort" :column="chosen.code" :label="t('central.labs.texts.inLab', { language: chosen.native_name, lab: lab.name })" />
              <th class="p-3 text-start font-semibold">{{ t('central.labs.texts.master') }}</th>
              <th class="p-3" />
            </template>
            <template v-else>
              <DlSortHeader v-for="item in languages" :key="item.code" v-model="sort" :column="item.code" :label="item.native_name" />
              <th class="p-3 text-start font-semibold">{{ t('central.labs.texts.masterFrench') }}</th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" class="border-b border-dl-line-soft align-top">
            <td class="p-3 font-mono text-[12.5px] text-dl-body">{{ row.key }}</td>
            <template v-if="chosen">
              <td class="min-w-56 p-3" :class="row.changed_for_lab && 'bg-dl-signal-soft'">
                <DlTextarea
                  v-if="canEdit"
                  :model-value="textOf(row)"
                  :label="`${chosen.native_name}: ${row.key}`"
                  hide-label
                  :dir="chosen.direction"
                  :changed="row.key in edits"
                  :error="rowErrors[row.key]"
                  @update:model-value="edit(row, $event)"
                />
                <span v-else-if="row.value" :dir="chosen.direction">{{ row.value }}</span>
                <span v-else class="text-xs text-dl-muted">{{ t('central.translations.state.missing') }}</span>
                <DlBadge v-if="row.changed_for_lab" tone="warning" size="sm" class="mt-1">{{ t('central.labs.texts.changed') }}</DlBadge>
                <p v-if="row.state === 'check' && !(row.key in edits)" class="mt-1 text-xs text-dl-pending">{{ t('central.translations.toCheck') }}</p>
              </td>
              <td class="p-3 text-dl-muted" :dir="chosen.direction">{{ row.master ?? '—' }}</td>
              <td class="w-56 p-3">
                <template v-if="canEdit && row.changed_for_lab">
                  <DlButton v-if="puttingBack !== row.key" variant="outline" size="sm" @click="puttingBack = row.key">{{ t('central.labs.texts.putBack') }}</DlButton>
                  <template v-else>
                    <p class="mb-1.5 text-[12.5px]">{{ row.master ? t('central.labs.texts.putBackAsk', { text: row.master }) : t('central.labs.texts.putBackEmpty') }}</p>
                    <div class="flex gap-1.5">
                      <DlButton variant="dark" size="sm" @click="putBack(row)">{{ t('central.labs.texts.putBack') }}</DlButton>
                      <DlButton variant="ghost" size="sm" @click="puttingBack = null">{{ t('common.actions.cancel') }}</DlButton>
                    </div>
                  </template>
                </template>
              </td>
            </template>
            <template v-else>
              <td v-for="item in languages" :key="item.code" class="p-3" :class="row.changed?.includes(item.code) && 'bg-dl-signal-soft'">
                <span v-if="row.texts?.[item.code]" :dir="directionOf(item.code)">{{ row.texts[item.code] }}</span>
                <span v-else class="text-xs text-dl-muted">{{ t('central.translations.state.missing') }}</span>
              </td>
              <td class="p-3 text-dl-muted">{{ row.master ?? '—' }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!chosen && canEdit" class="text-xs text-dl-muted">{{ t('central.labs.texts.chooseHint') }}</p>
    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <div v-if="changes" class="sticky bottom-3 flex items-center gap-3 rounded-[18px] bg-dl-ink py-2.5 pe-3 ps-[18px] text-sm text-dl-on-ink">
      <span>{{ t('central.translations.changes', { count: n(changes) }) }} <small class="block text-xs opacity-75">{{ t('central.labs.texts.saveHint') }}</small></span>
      <DlButton variant="ghost" size="sm" class="ms-auto text-dl-on-ink! hover:bg-dl-ink-2!" @click="undo">{{ t('central.roles.undo') }}</DlButton>
      <DlButton variant="primary" size="sm" :loading="saving" @click="save">{{ t('central.translations.save') }}</DlButton>
    </div>
  </div>
</template>

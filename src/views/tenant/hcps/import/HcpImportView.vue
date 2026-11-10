<script setup lang="ts">
import type { WorkBook } from 'xlsx'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { checkHcpImport, runHcpImport, type HcpImportProblem, type HcpImportResult, type HcpImportRow } from '@/api/tenant/hcps'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlProgress from '@/components/DlProgress.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSteps from '@/components/DlSteps.vue'
import { exportToXlsx } from '@/composables/exportXlsx'
import { useToast } from '@/composables/useToast'
import { IMPORT_TARGETS, NEEDED_FOR_NEW, TEMPLATE_TARGETS, autoMatch, batches, buildRow, fileDuplicates, type ImportTarget } from './hcpImport'

// Excel import of professionals, 4 steps: file → columns → check → done. The file is read here; the API
// checks every row before anything is saved, then adds new professionals and updates the ones whose
// OneKey ID exists (empty cells keep what is there). Mockup: docs/design/customers-mockups/HcpImport.html
const { t, n } = useI18n()
const toast = useToast()

const MAX_ROWS = 20_000
const BATCH = 200
const SKIP = '__skip'

const step = ref(0)
const steps = computed(() => [t('hcpImport.steps.file'), t('hcpImport.steps.columns'), t('hcpImport.steps.check'), t('hcpImport.steps.done')])
const label = (target: ImportTarget | string) => t(`hcpImport.fields.${target}`)

// ── 1. File ────────────────────────────────────────────────────────────────
const fileName = ref('')
const book = shallowRef<WorkBook | null>(null)
// SheetJS is loaded only on this page, when a file is chosen (as the exports).
let XLSX: typeof import('xlsx') | null = null
const sheet = ref('')
const headers = ref<string[]>([])
/** Data lines: their line number in the file and their cells. */
const lines = shallowRef<{ line: number; cells: unknown[] }[]>([])
const fileError = ref('')
const dragging = ref(false)

async function readFile(file?: File | null) {
  if (!file) return
  fileError.value = ''
  try {
    XLSX ??= await import('xlsx')
    book.value = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    fileName.value = file.name
    openSheet(book.value.SheetNames[0] ?? '')
  }
  catch {
    fileError.value = t('hcpImport.file.unreadable')
  }
}
function openSheet(name: string) {
  if (!book.value || !XLSX) return
  sheet.value = name
  // raw: numbers stay numbers (Excel dates arrive as day numbers, read by the API).
  const grid = XLSX.utils.sheet_to_json<unknown[]>(book.value.Sheets[name]!, { header: 1, raw: true, defval: '', blankrows: false })
  headers.value = (grid[0] ?? []).map(cell => String(cell ?? '').trim())
  lines.value = grid.slice(1)
    .map((cells, index) => ({ line: index + 2, cells }))
    .filter(({ cells }) => cells.some(cell => String(cell ?? '').trim() !== ''))
  if (!headers.value.length || !lines.value.length) {
    fileError.value = t('hcpImport.file.empty')
    return
  }
  if (lines.value.length > MAX_ROWS) {
    fileError.value = t('hcpImport.file.tooMany', { max: n(MAX_ROWS) })
    return
  }
  mapping.value = autoMatch(headers.value, label)
  step.value = 1
}
function onDrop(event: DragEvent) {
  dragging.value = false
  readFile(event.dataTransfer?.files?.[0])
}
function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  readFile(input.files?.[0])
  input.value = ''
}
function downloadTemplate() {
  const example: Record<string, string> = {
    name: 'Dr Karim Benali', type: t('hcps.types.doctor'), gender: t('hcps.genders.male'), speciality: 'Cardiologie', hco: 'CHU Mustapha',
    since: '01/03/2019', wilaya: 'Alger', commune: 'Hydra', address: '12 rue Didouche', gps: '36.7431,3.0412', phone: '0550778899',
    email: 'k.benali@example.com', fax: '', one_key_id: 'WDZM00123456', wkp_id: 'WDZH00004521',
  }
  exportToXlsx([Object.fromEntries(TEMPLATE_TARGETS.map(target => [label(target), example[target] ?? '']))], t('hcpImport.file.templateName'), t('hcps.title'))
}

// ── 2. Columns ─────────────────────────────────────────────────────────────
const mapping = ref<(ImportTarget | null)[]>([])
const targetOptions = computed(() => [{ value: SKIP, label: t('hcpImport.columns.skip') }, ...IMPORT_TARGETS.map(target => ({ value: target, label: label(target) }))])
function setTarget(index: number, value: string | number | null | undefined) {
  const target = value === SKIP || value == null ? null : (value as ImportTarget)
  // A field goes to one column: taking it frees the other column.
  mapping.value = mapping.value.map((current, i) => (i === index ? target : current === target ? null : current))
}
const samples = (index: number) => lines.value.map(({ cells }) => String(cells[index] ?? '').trim()).filter(Boolean).slice(0, 2).join(' · ') || '—'
const matchedCount = computed(() => mapping.value.filter(Boolean).length)
const mapped = computed(() => new Set(mapping.value.filter(Boolean)))
/** Fields a new professional needs that no column gives (the name can come from first + last name). */
const missingForNew = computed(() => NEEDED_FOR_NEW.filter(target =>
  !mapped.value.has(target) && !(target === 'name' && (mapped.value.has('first_name') || mapped.value.has('last_name')))))
const canCheck = computed(() => mapped.value.has('one_key_id'))

// ── 3. Check ───────────────────────────────────────────────────────────────
const rows = shallowRef<HcpImportRow[]>([])
const results = shallowRef<HcpImportResult[]>([])
const progress = ref(0)
const busy = ref(false)

async function runBatches(list: HcpImportRow[], call: typeof checkHcpImport) {
  const out: HcpImportResult[] = []
  progress.value = 0
  const parts = batches(list, BATCH)
  for (const [index, part] of parts.entries()) {
    out.push(...await call(part))
    progress.value = Math.round(((index + 1) / parts.length) * 100)
  }
  return out
}

async function check() {
  rows.value = lines.value.map(({ line, cells }) => buildRow(cells, mapping.value, line))
  step.value = 2
  busy.value = true
  try {
    const checked = await runBatches(rows.value, checkHcpImport)
    // Duplicates inside the file (the API sees one batch at a time).
    const inFile = fileDuplicates(rows.value)
    results.value = checked.map(result => {
      const extra = inFile.get(result.row)
      return extra ? { ...result, action: 'error' as const, errors: [...result.errors, ...extra] } : result
    })
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
    step.value = 1
  }
  finally {
    busy.value = false
  }
}

const count = (list: HcpImportResult[], action: HcpImportResult['action']) => list.filter(result => result.action === action).length
const summary = computed(() => [
  { key: 'create', value: count(results.value, 'create'), tone: 'text-[#0F7A3D] dark:text-[#5CD08F]' },
  { key: 'update', value: count(results.value, 'update'), tone: 'text-dl-cobalt' },
  { key: 'unchanged', value: count(results.value, 'unchanged'), tone: '' },
  { key: 'error', value: count(results.value, 'error'), tone: 'text-dl-rejected' },
])
const problems = computed(() => results.value.filter(result => result.action === 'error'))
const warned = computed(() => results.value.filter(result => result.action !== 'error' && result.warnings.length))
const toImport = computed(() => count(results.value, 'create') + count(results.value, 'update'))
const SHOWN = 50

function problemText(problem: HcpImportProblem) {
  const params = { field: label(problem.field), value: problem.value ?? '', other: problem.other ?? '' }
  if (problem.field === 'hco' && problem.code === 'not_found') return t('hcpImport.problems.hcoNotFound', params)
  if (problem.field === 'commune' && problem.code === 'ambiguous') return t('hcpImport.problems.ambiguousCommune', params)
  const key = problem.code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
  return t(`hcpImport.problems.${key}`, params)
}

/** The rows with problems, as in the file, plus a "Problems" column: fix them and import the file again. */
function downloadProblems(list: HcpImportResult[]) {
  const byLine = new Map(lines.value.map(item => [item.line, item.cells]))
  exportToXlsx(list.map(result => ({
    ...Object.fromEntries(headers.value.map((header, index) => [header || `#${index + 1}`, byLine.get(result.row)?.[index] ?? ''])),
    [t('hcpImport.check.problemsColumn')]: result.errors.map(problemText).join(' · '),
  })), `${fileName.value.replace(/\.[^.]+$/, '')} - ${t('hcpImport.check.problemsFile')}`, t('hcpImport.check.problemsFile'))
}

// ── 4. Import ──────────────────────────────────────────────────────────────
const done = shallowRef<HcpImportResult[]>([])

async function runImport() {
  const good = new Set(results.value.filter(result => result.action === 'create' || result.action === 'update').map(result => result.row))
  step.value = 3
  busy.value = true
  try {
    done.value = await runBatches(rows.value.filter(row => good.has(row.row)), runHcpImport)
  }
  catch {
    toast.error(t('hcpImport.done.interrupted'))
  }
  finally {
    busy.value = false
  }
}
/** Left out: the rows with problems at the check, and any that failed while saving. */
const leftOut = computed(() => [...problems.value, ...done.value.filter(result => result.action === 'error')])

function restart() {
  step.value = 0
  book.value = null
  fileName.value = ''
  results.value = []
  done.value = []
}
</script>

<template>
  <div class="flex w-full flex-col gap-5 pb-10">
    <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex flex-wrap items-center gap-1.5 text-sm text-dl-muted">
      <span>{{ t('nav.workspaces.customers') }}</span>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <RouterLink :to="{ name: 'tenant-hcps' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('hcps.title') }}</RouterLink>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <span>{{ t('hcpImport.title') }}</span>
    </nav>

    <div class="flex items-end justify-between gap-4">
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[34px]">{{ t('hcpImport.title') }}</h1>
      <DlButton v-if="step < 3" variant="ghost" icon="tabler-x" :to="{ name: 'tenant-hcps' }">{{ t('common.actions.cancel') }}</DlButton>
    </div>

    <!-- A desktop task: on a phone, say so. -->
    <p class="rounded-3xl bg-dl-paper p-5 text-sm text-dl-body md:hidden">{{ t('hcpImport.phone') }}</p>

    <div class="flex flex-col gap-5 max-md:hidden">
      <DlSteps :steps="steps" :current="step" />

      <!-- 1. File -->
      <section v-if="step === 0" class="flex flex-col gap-5 rounded-3xl bg-dl-paper p-6">
        <label
          class="flex cursor-pointer flex-col items-center gap-2.5 rounded-[20px] border-2 border-dashed px-6 py-10 text-center transition"
          :class="dragging ? 'border-dl-cobalt bg-dl-cobalt/5' : 'border-dl-line bg-dl-mist hover:border-dl-muted'"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
        >
          <DlIcon icon="tabler-file-spreadsheet" :size="40" class="text-dl-muted" />
          <strong class="text-base">{{ t('hcpImport.file.drop') }} <span class="text-dl-cobalt underline">{{ t('hcpImport.file.choose') }}</span></strong>
          <span class="text-xs text-dl-muted">{{ t('hcpImport.file.formats', { max: n(MAX_ROWS) }) }}</span>
          <input type="file" accept=".xlsx,.xls,.csv" class="sr-only" @change="onPick">
        </label>
        <p v-if="fileError" class="text-sm text-dl-rejected" role="alert">{{ fileError }}</p>
        <div class="grid gap-3 md:grid-cols-3">
          <div class="rounded-2xl bg-dl-mist p-4 text-[13px] text-dl-body">
            <strong class="mb-1 block text-dl-fg">{{ t('hcpImport.file.rule1Title') }}</strong>{{ t('hcpImport.file.rule1') }}
            <button type="button" class="mt-1 block font-semibold text-dl-cobalt hover:underline" @click="downloadTemplate">{{ t('hcpImport.file.template') }} ⇩</button>
          </div>
          <div class="rounded-2xl bg-dl-mist p-4 text-[13px] text-dl-body"><strong class="mb-1 block text-dl-fg">{{ t('hcpImport.file.rule2Title') }}</strong>{{ t('hcpImport.file.rule2') }}</div>
          <div class="rounded-2xl bg-dl-mist p-4 text-[13px] text-dl-body"><strong class="mb-1 block text-dl-fg">{{ t('hcpImport.file.rule3Title') }}</strong>{{ t('hcpImport.file.rule3') }}</div>
        </div>
      </section>

      <!-- 2. Columns -->
      <section v-else-if="step === 1" class="flex flex-col gap-1.5 rounded-3xl bg-dl-paper p-6">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <strong>{{ fileName }}</strong>
            <DlSelect v-if="(book?.SheetNames.length ?? 0) > 1" :model-value="sheet" :label="t('hcpImport.columns.sheet')" :options="book!.SheetNames.map(name => ({ value: name, label: name }))" appearance="filter" @update:model-value="value => openSheet(String(value))" />
            <span class="text-xs text-dl-muted">· {{ t('hcpImport.columns.rows', { n: n(lines.length) }) }}</span>
          </div>
          <span class="rounded-full bg-dl-signal-soft px-2.5 py-1 text-xs font-semibold">✓ {{ t('hcpImport.columns.matched', { n: matchedCount, total: headers.length }) }}</span>
        </div>
        <div class="grid grid-cols-[1fr_24px_minmax(0,1fr)_1.3fr] gap-3 border-b border-dl-line pb-2 text-xs font-semibold text-dl-muted">
          <span>{{ t('hcpImport.columns.inFile') }}</span><span /><span>{{ t('hcpImport.columns.field') }}</span><span>{{ t('hcpImport.columns.firstValues') }}</span>
        </div>
        <div v-for="(header, index) in headers" :key="index" class="grid grid-cols-[1fr_24px_minmax(0,1fr)_1.3fr] items-center gap-3 border-b border-dl-line-soft py-2 text-sm">
          <strong class="truncate">{{ header || `#${index + 1}` }}</strong>
          <DlIcon icon="tabler-arrow-right" :size="15" class="text-dl-muted rtl:-scale-x-100" />
          <DlSelect :model-value="mapping[index] ?? SKIP" :label="header || `#${index + 1}`" hide-label :options="targetOptions" @update:model-value="value => setTarget(index, value)" />
          <span class="truncate text-[12.5px] text-dl-muted">{{ samples(index) }}</span>
        </div>
        <p class="mt-3 rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-body">
          {{ t('hcpImport.columns.rules') }}
          <strong v-if="!canCheck" class="text-dl-rejected">{{ t('hcpImport.columns.needOneKey') }}</strong>
          <strong v-else-if="missingForNew.length" class="text-dl-pending">{{ t('hcpImport.columns.missingForNew', { fields: missingForNew.map(label).join(', ') }) }}</strong>
        </p>
        <div class="mt-3 flex justify-between">
          <DlButton variant="outline" @click="step = 0">{{ t('users.add.back') }}</DlButton>
          <DlButton variant="dark" :disabled="!canCheck" @click="check">{{ t('hcpImport.columns.check') }}</DlButton>
        </div>
      </section>

      <!-- 3. Check -->
      <section v-else-if="step === 2" class="flex flex-col gap-4 rounded-3xl bg-dl-paper p-6">
        <div v-if="busy" class="flex flex-col gap-2 py-6">
          <strong class="text-sm">{{ t('hcpImport.check.running', { n: n(lines.length) }) }}</strong>
          <DlProgress :value="progress" :label="t('hcpImport.check.running', { n: n(lines.length) })" />
        </div>
        <template v-else>
          <dl class="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div v-for="item in summary" :key="item.key" class="flex flex-col gap-0.5 rounded-2xl bg-dl-mist px-4 py-3">
              <dt class="text-xs text-dl-muted">{{ t(`hcpImport.check.${item.key}`) }}</dt>
              <dd class="font-display text-[24px] font-extrabold tabular-nums" :class="item.tone">{{ n(item.value) }}</dd>
              <dd class="text-[11.5px] text-dl-muted">{{ t(`hcpImport.check.${item.key}Note`) }}</dd>
            </div>
          </dl>

          <div v-if="problems.length" class="flex flex-col">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-1">
              <strong class="text-sm">{{ t('hcpImport.check.problemsTitle', { n: n(problems.length) }, problems.length) }}</strong>
              <button type="button" class="text-sm font-semibold text-dl-cobalt hover:underline" @click="downloadProblems(problems)">⇩ {{ t('hcpImport.check.download') }}</button>
            </div>
            <div class="grid grid-cols-[70px_1.2fr_2.4fr] gap-3 border-b border-dl-line py-2 text-xs font-semibold text-dl-muted">
              <span>{{ t('hcpImport.check.line') }}</span><span>{{ t('hcpImport.check.professional') }}</span><span>{{ t('hcpImport.check.problem') }}</span>
            </div>
            <div v-for="result in problems.slice(0, SHOWN)" :key="result.row" class="grid grid-cols-[70px_1.2fr_2.4fr] gap-3 border-b border-dl-line-soft py-2 text-[13px]">
              <span class="tabular-nums">{{ n(result.row) }}</span>
              <strong class="truncate">{{ result.name || '—' }}</strong>
              <span class="flex flex-col text-dl-rejected"><span v-for="(problem, i) in result.errors" :key="i">{{ problemText(problem) }}</span></span>
            </div>
            <p v-if="problems.length > SHOWN" class="pt-2 text-xs text-dl-muted">{{ t('hcpImport.check.more', { n: n(problems.length - SHOWN) }) }}</p>
          </div>
          <p v-if="warned.length" class="rounded-xl bg-dl-pending/10 px-3 py-2 text-xs text-dl-body">
            <strong class="text-dl-pending">{{ t('hcpImport.check.warningsTitle', { n: n(warned.length) }, warned.length) }}</strong>
            {{ t('hcpImport.problems.workplaceIncomplete') }}
          </p>

          <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-body">{{ t('hcpImport.check.rules') }}</p>
          <div class="flex flex-wrap justify-between gap-2">
            <DlButton variant="outline" @click="step = 1">{{ t('hcpImport.check.back') }}</DlButton>
            <DlButton variant="primary" :disabled="!toImport" @click="runImport">
              {{ problems.length ? t('hcpImport.check.importGood', { n: n(toImport) }, toImport) : t('hcpImport.check.importAll', { n: n(toImport) }, toImport) }}
            </DlButton>
          </div>
          <p v-if="problems.length" class="text-end text-xs text-dl-muted">{{ t('hcpImport.check.leftOutHint', { n: n(problems.length) }, problems.length) }}</p>
        </template>
      </section>

      <!-- 4. Done -->
      <section v-else class="flex flex-col items-center gap-3 rounded-3xl bg-dl-paper p-8 text-center">
        <template v-if="busy">
          <strong class="text-sm">{{ t('hcpImport.done.running') }}</strong>
          <DlProgress :value="progress" :label="t('hcpImport.done.running')" class="w-full max-w-lg" />
          <span class="text-xs text-dl-muted">{{ t('hcpImport.done.keepOpen') }}</span>
        </template>
        <template v-else>
          <span class="flex h-16 w-16 items-center justify-center rounded-[20px] bg-dl-signal text-[#0F1F1C]"><DlIcon icon="tabler-check" :size="30" /></span>
          <h2 class="font-display text-[26px] font-extrabold">{{ t('hcpImport.done.title', { n: n(count(done, 'create') + count(done, 'update')) }, count(done, 'create') + count(done, 'update')) }}</h2>
          <p class="text-sm text-dl-muted">
            {{ t('hcpImport.done.line', { created: n(count(done, 'create')), updated: n(count(done, 'update')), left: n(leftOut.length) }) }}
          </p>
          <div class="mt-2 flex flex-wrap justify-center gap-2">
            <DlButton v-if="leftOut.length" variant="outline" icon="tabler-download" @click="downloadProblems(leftOut)">{{ t('hcpImport.done.leftOut', { n: n(leftOut.length) }, leftOut.length) }}</DlButton>
            <DlButton variant="outline" @click="restart">{{ t('hcpImport.done.another') }}</DlButton>
            <DlButton variant="outline" :to="{ name: 'tenant-hcps', query: { missing: 'gps' } }">{{ t('hcpImport.done.missing') }}</DlButton>
            <DlButton variant="dark" :to="{ name: 'tenant-hcps' }">{{ t('hcpImport.done.toList') }}</DlButton>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

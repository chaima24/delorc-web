<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { fieldErrors } from '@/api/errors'
import { createTerritory } from '@/api/tenant/territories'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import { useTerritories, useUsers } from './useTerritoryLookups'
import { useToast } from '@/composables/useToast'
import { today } from '@/views/tenant/users/userDisplay'
import CoverageCount from './CoverageCount.vue'
import CoversEditor from './CoversEditor.vue'
import TerritoryCreatePeople from './TerritoryCreatePeople.vue'
import TerritoryDetailsFields, { type TerritoryDetailsForm } from './TerritoryDetailsFields.vue'
import { coversOf, toCoversPayload, type CoverPick, type Zones } from './coversForm'
import { personName, useTerritoryText } from './territoryText'
import { useCoverage } from './useCoverage'
import { useTerritoryTypes } from './useTerritoryTypes'

// Add a territory on its own page, in 3 steps: Details · What it covers · Who works it (optional).
// A summary with the live count sits beside the form (under it on a phone). ?parent= fills "Part of".
// Mockup: docs/design/customers-mockups/Territories.html (frames 3–5)
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const types = useTerritoryTypes()
const shared = useTerritories()
const users = useUsers()
const text = useTerritoryText()
const { te: has } = useI18n()
shared.ensureLoaded()

const steps = computed(() => [t('territories.add.steps.details'), t('territories.add.steps.covers'), t('territories.add.steps.people')])
const step = ref(0)
const details = ref<TerritoryDetailsForm>({ name: '', parent_id: Number(route.query.parent) || null, sector: '', description: '' })
const picks = ref<CoverPick[]>([])
const zones = ref<Zones>({})
const people = ref<number[]>([])
const start = ref(today())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const { coverage, counting } = useCoverage(picks)

const parentName = computed(() => shared.items.value.find(item => item.id === details.value.parent_id)?.name ?? '')
const coversText = computed(() => text.list(picks.value.map(pick => pick.name), 4))
const peopleText = computed(() => people.value
  .map(id => users.items.value.find(user => user.id === id))
  .map(user => (user ? personName(user) : ''))
  .filter(Boolean)
  .join(', '))

function check(upTo: number) {
  errors.value = {}
  if (upTo >= 0 && !details.value.name.trim()) {
    errors.value.name = t('users.add.required')
    step.value = 0
  }
  else if (upTo >= 1 && !picks.value.length) {
    errors.value.covers = t('territories.covers.required')
    step.value = 1
  }
  return !Object.keys(errors.value).length
}
function next() {
  if (check(step.value)) step.value++
}
function goTo(index: number) {
  if (index < step.value) step.value = index
}

async function save() {
  if (!check(1)) return
  saving.value = true
  try {
    const created = await createTerritory({
      name: details.value.name.trim(), parent_id: details.value.parent_id, sector: details.value.sector.trim() || null, description: details.value.description.trim() || null,
      ...toCoversPayload(types.all.value, picks.value, zones.value),
      ...(people.value.length ? { assign: { user_ids: people.value, start_date: start.value } } : {}),
    })
    toast.success(t('territories.add.done', { name: created.name }))
    if (shared.loaded.value) shared.refresh()
    router.push({ name: 'tenant-territory-detail', params: { id: created.id } })
  }
  catch (error) {
    const found = fieldErrors(error)
    if (!Object.keys(found).length) {
      toast.error(t('studio.list.toast.failed'))
      return
    }
    const message = (code: string) => (has(`territories.errors.${code}`) ? t(`territories.errors.${code}`) : code)
    // assign.people.12 → people.12 (the person's row), other keys → their last part.
    errors.value = Object.fromEntries(Object.entries(found).map(([key, text]) => [
      key.startsWith('assign.people.') ? key.slice('assign.'.length) : key.split('.').pop()!,
      message(text),
    ]))
    const keys = Object.keys(found)
    if (keys.some(key => ['name', 'sector', 'description', 'parent_id'].includes(key))) step.value = 0
    else if (keys.some(key => key.startsWith('covers') || key.startsWith('zones'))) {
      errors.value.covers = message(Object.values(found)[0]!)
      step.value = 1
    }
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5 pb-10">
    <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex flex-wrap items-center gap-1.5 text-sm text-dl-muted">
      <span>{{ t('nav.workspaces.plan') }}</span>
      <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
      <RouterLink :to="{ name: 'tenant-territories' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('territories.title') }}</RouterLink>
    </nav>
    <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[36px]">{{ t('territories.add.title') }}</h1>

    <ol class="grid grid-cols-3 gap-2" :aria-label="steps.join(', ')">
      <li v-for="(name, index) in steps" :key="name">
        <button
          type="button"
          class="flex h-full w-full items-center gap-2.5 rounded-2xl bg-dl-paper px-3 py-2.5 text-start text-[13.5px] font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt md:px-3.5"
          :class="index === step ? 'text-dl-fg ring-2 ring-dl-fg' : index < step ? 'text-dl-body hover:text-dl-fg' : 'cursor-default text-dl-muted'"
          :aria-current="index === step ? 'step' : undefined"
          :disabled="index > step"
          @click="goTo(index)"
        >
          <span
            class="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border text-[12.5px]"
            :class="index === step ? 'border-dl-ink bg-dl-ink text-dl-signal dark:border-dl-fg dark:bg-dl-fg dark:text-dl-mist' : index < step ? 'border-dl-mist bg-dl-mist' : 'border-dl-line'"
          >
            <DlIcon v-if="index < step" icon="tabler-check" :size="14" /><template v-else>{{ index + 1 }}</template>
          </span>
          <span class="min-w-0 max-sm:sr-only">{{ name }}</span>
        </button>
      </li>
    </ol>

    <form id="territory-create" class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]" @submit.prevent="step < 2 ? next() : save()">
      <div class="flex min-w-0 flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-5">
        <h2 class="text-base font-semibold sm:sr-only">{{ steps[step] }}</h2>
        <TerritoryDetailsFields v-if="step === 0" v-model:form="details" :errors="errors" />
        <CoversEditor v-else-if="step === 1" v-model:picks="picks" v-model:zones="zones" :types="types.pickable.value" :error="errors.covers" />
        <TerritoryCreatePeople v-else v-model:people="people" v-model:start="start" :errors="errors" :covers="coversOf(picks)" />
      </div>

      <aside class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('territories.add.summary')">
        <h2 class="text-[15px] font-semibold">{{ t('territories.add.summary') }}</h2>
        <dl class="grid grid-cols-[96px_1fr] gap-x-2.5 text-[13px]">
          <dt class="border-b border-dl-line-soft py-1.5 text-dl-muted">{{ t('territories.fields.name') }}</dt>
          <dd class="border-b border-dl-line-soft py-1.5" :class="!details.name.trim() && 'text-dl-muted'">{{ details.name.trim() || '—' }}</dd>
          <dt class="border-b border-dl-line-soft py-1.5 text-dl-muted">{{ t('territories.fields.parent') }}</dt>
          <dd class="border-b border-dl-line-soft py-1.5">{{ parentName || t('territories.position.top') }}</dd>
          <dt class="border-b border-dl-line-soft py-1.5 text-dl-muted">{{ t('territories.covers.title') }}</dt>
          <dd class="border-b border-dl-line-soft py-1.5" :class="!picks.length && 'text-dl-muted'">{{ coversText }}</dd>
          <dt class="py-1.5 text-dl-muted">{{ t('territories.people.title') }}</dt>
          <dd class="py-1.5" :class="!people.length && 'text-dl-muted'">{{ peopleText || t('territories.add.nobodyYet') }}</dd>
        </dl>
        <CoverageCount :coverage="coverage" :counting="counting" />
      </aside>
    </form>

    <div class="flex items-center gap-2.5 rounded-3xl bg-dl-paper p-3 md:px-4">
      <DlButton v-if="step === 0" variant="ghost" :to="{ name: 'tenant-territories' }">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton v-else variant="outline" @click="step--">{{ t('users.add.back') }}</DlButton>
      <DlButton v-if="step < 2" type="submit" form="territory-create" variant="dark" class="ms-auto">{{ t('users.add.next') }}</DlButton>
      <DlButton v-else type="submit" form="territory-create" variant="primary" class="ms-auto" :loading="saving">{{ people.length ? t('territories.add.save') : t('territories.add.saveAlone') }}</DlButton>
    </div>
  </div>
</template>

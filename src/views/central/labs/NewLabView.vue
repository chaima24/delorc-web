<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { countriesApi, type Country } from '@/api/central/geography'
import { labsApi, type Lab, type NewLab } from '@/api/central/labs'
import { languagesApi, type Language } from '@/api/central/languages'
import { plansApi, type Plan } from '@/api/central/plans'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useLabTexts } from './useLabTexts'

const { t } = useI18n()
const { day, money } = useLabTexts()

const countries = ref<Country[]>([])
const plans = ref<Plan[]>([])
const languages = ref<Language[]>([])
const form = ref<NewLab>({
  id: '', name: '', country_id: null, plan_id: null, language_id: null,
  email: '', phone: '', contact_email: '', admin_name: '', admin_email: '', admin_phone: '',
  website: '', address: '', latitude: '', longitude: '', notes: '', logo: null,
})
const errors = ref<Record<string, string>>({})
const error = ref<string | null>(null)
const created = ref<{ lab: Lab; linkSent: boolean } | null>(null)
const busy = ref(false)

/** "Demo Pharma" → "demopharma": lowercase letters and digits only, as the API asks. */
const suggestSlug = (name: string) => name.normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
const slugTyped = ref(false)
watch(() => form.value.name, (name) => {
  if (!slugTyped.value) form.value.id = suggestSlug(name)
})

const countryOptions = computed(() => countries.value.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name })))
const planOptions = computed(() => plans.value.filter((p) => p.is_active).map((p) => ({ value: p.id, label: `${p.name} · ${money(p.monthly_price, p.currency)}` })))
const languageOptions = computed(() => languages.value.filter((l) => l.is_active).map((l) => ({ value: l.id, label: l.native_name })))
const activeLanguages = computed(() => languages.value.filter((l) => l.is_active).length)
const country = computed(() => countries.value.find(({ id }) => id === form.value.country_id))
const plan = computed(() => plans.value.find(({ id }) => id === form.value.plan_id))

onMounted(async () => {
  try {
    [countries.value, plans.value, languages.value] = await Promise.all([countriesApi.list(), plansApi.list(), languagesApi.list()])
    form.value.language_id = languages.value.find(({ code }) => code === 'fr')?.id ?? null
    if (countryOptions.value.length === 1) form.value.country_id = countryOptions.value[0]!.value
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
})

function pickLogo(event: Event): void {
  form.value.logo = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function create(): Promise<void> {
  busy.value = true
  errors.value = {}
  error.value = null
  try {
    const answer = await labsApi.create(form.value)
    created.value = { lab: answer.data, linkSent: answer.access_link_sent }
  } catch (failure) {
    errors.value = fieldErrors(failure)
    if (!Object.keys(errors.value).length) error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <RouterLink :to="{ name: 'central-labs' }" class="text-[13px] font-semibold text-dl-muted no-underline hover:underline">{{ t('central.labs.title') }}</RouterLink>
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.labs.add') }}</h1>
    </div>

    <div class="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
      <form class="flex flex-col gap-4" @submit.prevent="create">
        <fieldset :disabled="created !== null" class="contents">
          <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-[18px]">
            <h2 class="text-[15px] font-bold">{{ t('central.labs.theLab') }}</h2>
            <DlInput v-model="form.name" :label="t('central.labs.name')" :error="errors.name" />
            <div class="grid gap-3 sm:grid-cols-2">
              <DlInput v-model="form.id" :label="t('central.labs.slug')" :hint="t('central.labs.slugHint')" :error="errors.id" @input="slugTyped = true" />
              <DlInput :model-value="`${form.id || '…'}.localhost`" :label="t('central.labs.address')" :hint="t('central.labs.databaseHint', { database: `delorc_${form.id || '…'}` })" disabled />
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <div><DlSelect v-model="form.country_id" :label="t('central.labs.country')" :options="countryOptions" /><p class="mt-1 text-xs" :class="errors.country_id ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.country_id ?? t('central.labs.countryHint') }}</p></div>
              <div><DlSelect v-model="form.plan_id" :label="t('central.labs.plan')" :options="planOptions" /><p class="mt-1 text-xs" :class="errors.plan_id ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.plan_id ?? t('central.labs.activeOnly') }}</p></div>
              <div><DlSelect v-model="form.language_id" :label="t('central.labs.language')" :options="languageOptions" /><p class="mt-1 text-xs" :class="errors.language_id ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.language_id ?? t('central.labs.activeOnly') }}</p></div>
            </div>
          </section>

          <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-[18px]">
            <h2 class="text-[15px] font-bold">{{ t('central.labs.contact') }}</h2>
            <div class="grid gap-3 sm:grid-cols-2">
              <DlInput v-model="form.email" type="email" :label="t('central.labs.email')" :hint="t('central.labs.uniqueHint')" :error="errors.email" />
              <DlInput v-model="form.phone" type="tel" :label="t('central.labs.phone')" :hint="t('central.labs.uniqueHint')" :error="errors.phone" />
            </div>
            <DlInput v-model="form.contact_email" type="email" :label="t('central.labs.contactEmail')" :hint="t('central.labs.contactEmailHint')" :error="errors.contact_email" />
          </section>

          <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-[18px]">
            <h2 class="text-[15px] font-bold">{{ t('central.labs.firstAdmin') }}</h2>
            <DlInput v-model="form.admin_name" :label="t('central.labs.adminName')" :error="errors.admin_name" />
            <div class="grid gap-3 sm:grid-cols-2">
              <DlInput v-model="form.admin_email" type="email" :label="t('central.labs.adminEmail')" :hint="t('central.labs.adminEmailHint')" :error="errors.admin_email" />
              <DlInput v-model="form.admin_phone" type="tel" :label="t('central.labs.adminPhone')" :error="errors.admin_phone" />
            </div>
            <p class="text-xs text-dl-muted">{{ t('central.labs.firstAdminHint') }}</p>
          </section>

          <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-[18px]">
            <h2 class="text-[15px] font-bold">{{ t('central.labs.more') }} <span class="text-[13px] font-normal text-dl-muted">· {{ t('central.labs.moreHint') }}</span></h2>
            <div class="grid gap-3 sm:grid-cols-2">
              <DlInput v-model="form.website" type="url" :label="t('central.labs.website')" :error="errors.website" />
              <DlInput v-model="form.address" :label="t('central.labs.postalAddress')" :error="errors.address" />
              <DlInput v-model="form.latitude" :label="t('central.labs.latitude')" inputmode="decimal" :error="errors.latitude" />
              <DlInput v-model="form.longitude" :label="t('central.labs.longitude')" inputmode="decimal" :error="errors.longitude" />
            </div>
            <label class="flex flex-col gap-1.5 text-[13px] font-semibold">
              {{ t('central.labs.logo') }}
              <input type="file" accept=".png,.jpg,.jpeg,.svg" class="text-sm font-normal" @change="pickLogo">
              <span class="text-xs font-normal" :class="errors.logo ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.logo ?? t('central.labs.logoHint') }}</span>
            </label>
            <DlTextarea v-model="form.notes" :label="t('central.labs.notes')" :hint="t('central.labs.notesHint')" :rows="2" :error="errors.notes" />
          </section>
        </fieldset>

      </form>

      <aside class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-[18px] lg:sticky lg:top-5">
        <template v-if="created">
          <h2 class="text-[15px] font-bold">{{ t('central.labs.ready', { name: created.lab.name }) }}</h2>
          <ul class="flex flex-col gap-2.5 text-[13.5px]">
            <li class="flex gap-2.5"><DlIcon icon="tabler-circle-check" :size="20" class="text-dl-fg" />{{ t('central.labs.done.database', { database: `delorc_${created.lab.id}` }) }}</li>
            <li class="flex gap-2.5"><DlIcon icon="tabler-circle-check" :size="20" class="text-dl-fg" />{{ t('central.labs.done.places', created.lab.copied ?? {}) }}</li>
            <li class="flex gap-2.5"><DlIcon icon="tabler-circle-check" :size="20" class="text-dl-fg" />{{ t('central.labs.done.languages', { count: created.lab.copied?.languages.length ?? 0 }) }}</li>
            <li class="flex gap-2.5"><DlIcon icon="tabler-circle-check" :size="20" class="text-dl-fg" />{{ t('central.labs.done.weekend') }}</li>
            <li class="flex gap-2.5"><DlIcon icon="tabler-circle-check" :size="20" class="text-dl-fg" />{{ t('central.labs.done.trial', { plan: created.lab.plan?.name, from: day(created.lab.subscriptions[0]?.starts_on ?? null), to: day(created.lab.subscriptions[0]?.ends_on ?? null) }) }}</li>
            <li class="flex gap-2.5">
              <DlIcon :icon="created.linkSent ? 'tabler-circle-check' : 'tabler-alert-triangle'" :size="20" :class="created.linkSent ? 'text-dl-fg' : 'text-dl-pending'" />
              {{ created.linkSent ? t('central.labs.done.link', { email: created.lab.first_admin?.email }) : t('central.labs.done.linkNotSent') }}
            </li>
          </ul>
          <div class="flex flex-wrap gap-2">
            <DlButton variant="primary" size="sm" :to="{ name: 'central-lab', params: { id: created.lab.id } }">{{ t('central.labs.openPage') }}</DlButton>
            <DlButton variant="outline" size="sm" :to="{ name: 'central-labs' }">{{ t('central.labs.backToList') }}</DlButton>
          </div>
        </template>

        <template v-else>
          <h2 class="text-[15px] font-bold">{{ t('central.labs.whatHappens') }}</h2>
          <ol class="flex list-decimal flex-col gap-2 ps-5 text-[13.5px] text-dl-body">
            <li>{{ t('central.labs.will.database', { database: `delorc_${form.id || '…'}` }) }}</li>
            <li>{{ t('central.labs.will.places', { country: country?.name ?? '…' }) }}</li>
            <li>{{ t('central.labs.will.languages', { count: activeLanguages }) }}</li>
            <li>{{ t('central.labs.will.weekend') }}</li>
            <li>{{ t('central.labs.will.trial', { plan: plan?.name ?? '…' }) }}</li>
            <li>{{ t('central.labs.will.link', { name: form.admin_name || '…' }) }}</li>
          </ol>
          <p class="text-xs text-dl-muted">{{ t('central.labs.undoHint') }}</p>
          <DlAlert v-if="error">{{ error }}</DlAlert>
          <p v-if="Object.keys(errors).length" class="rounded-xl bg-dl-rejected/10 px-3 py-2 text-[13px] text-dl-rejected">{{ t('central.labs.fieldsToFix', { count: Object.keys(errors).length }) }}</p>
          <DlButton variant="primary" block :loading="busy" @click="create">{{ t('central.labs.create') }}</DlButton>
        </template>
      </aside>
    </div>
  </div>
</template>

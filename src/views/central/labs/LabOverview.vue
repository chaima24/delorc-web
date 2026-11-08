<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { labsApi, type Lab, type LabChanges } from '@/api/central/labs'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useAuthStore } from '@/stores/auth'
import { usePanelAction } from '../geography/usePanelAction'

const props = defineProps<{ lab: Lab }>()
const emit = defineEmits<{ changed: [lab: Lab] }>()

const { t, d, n } = useI18n()
const auth = useAuthStore()
const { errors, error, busy, run, clear } = usePanelAction()

/** One card is edited at a time; the others hide their Edit button. */
const editing = ref<'lab' | 'contact' | 'languages' | 'notes' | null>(null)
const form = ref({ name: '', website: '', address: '', latitude: '', longitude: '', email: '', phone: '', contact_email: '', notes: '', language_id: 0 })
const linkSent = ref(false)
const canEdit = computed(() => auth.can('labs.update'))
const canEditCard = (card: typeof editing.value) => canEdit.value && (editing.value === null || editing.value === card)
const languageOptions = computed(() => props.lab.copied_languages.map(({ id, native_name }) => ({ value: id, label: native_name })))

function reset(): void {
  const { lab } = props
  form.value = {
    name: lab.name, website: lab.website ?? '', address: lab.address ?? '', latitude: lab.latitude ?? '', longitude: lab.longitude ?? '',
    email: lab.email ?? '', phone: lab.phone ?? '', contact_email: lab.contact_email ?? '', notes: lab.notes ?? '', language_id: lab.language?.id ?? 0,
  }
  editing.value = null
  clear()
}

watch(() => props.lab, reset, { immediate: true })

/** Empty optional boxes are saved as empty. */
const orNull = (value: string) => value || null
const fields: Record<NonNullable<typeof editing.value>, () => LabChanges> = {
  lab: () => ({ name: form.value.name, website: orNull(form.value.website), address: orNull(form.value.address), latitude: orNull(form.value.latitude), longitude: orNull(form.value.longitude) }),
  contact: () => ({ email: form.value.email, phone: form.value.phone, contact_email: orNull(form.value.contact_email) }),
  languages: () => ({ language_id: form.value.language_id }),
  notes: () => ({ notes: orNull(form.value.notes) }),
}

const save = () => run(() => labsApi.update(props.lab.id, fields[editing.value!]()), (lab) => emit('changed', lab))
const replaceLogo = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) run(() => labsApi.replaceLogo(props.lab.id, file), (lab) => emit('changed', lab))
}
const removeLogo = () => run(async () => {
  await labsApi.removeLogo(props.lab.id)

  return labsApi.get(props.lab.id)
}, (lab) => emit('changed', lab))
const sendLink = () => run(() => labsApi.sendAccessLink(props.lab.id), () => { linkSent.value = true })

const editingModel = (card: NonNullable<typeof editing.value>) => computed({
  get: () => editing.value === card,
  set: (open: boolean) => { editing.value = open ? card : null },
})
const editingLab = editingModel('lab')
const editingContact = editingModel('contact')
const editingLanguages = editingModel('languages')
const editingNotes = editingModel('notes')
const row = 'flex gap-2.5 border-t border-dl-line-soft py-2 first:border-t-0'
</script>

<template>
  <div class="flex flex-col gap-4">
    <DlAlert v-if="error">{{ error }}</DlAlert>
    <div class="grid items-start gap-4 lg:grid-cols-2">
      <div class="flex flex-col gap-4">
        <DlRecordSection v-model:editing="editingLab" :title="t('central.labs.theLab')" :can-edit="canEditCard('lab')" :saving="busy" class="bg-dl-paper" @save="save" @cancel="reset">
          <dl>
            <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.labs.name') }}</dt><dd>{{ lab.name }}</dd></div>
            <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.labs.slug') }}</dt><dd>{{ lab.id }} · {{ t('central.labs.fixed') }}</dd></div>
            <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.labs.address') }}</dt><dd>{{ lab.id }}.localhost</dd></div>
            <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.labs.website') }}</dt><dd>{{ lab.website ?? '—' }}</dd></div>
            <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.labs.postalAddress') }}</dt><dd>{{ lab.address ?? '—' }}</dd></div>
            <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.labs.gps') }}</dt><dd>{{ lab.latitude ? `${lab.latitude}, ${lab.longitude}` : '—' }}</dd></div>
            <div :class="row"><dt class="flex-1 font-semibold">{{ t('common.list.createdAt') }}</dt><dd>{{ d(new Date(lab.created_at)) }}</dd></div>
          </dl>
          <div v-if="canEditCard('lab')" class="mt-2 flex flex-wrap items-center gap-2">
            <label class="inline-flex h-8 cursor-pointer items-center rounded-[9px] border border-dl-line px-2.5 text-[12.5px] font-semibold">
              {{ t(lab.logo_url ? 'central.labs.replaceLogo' : 'central.labs.addLogo') }}
              <input type="file" accept=".png,.jpg,.jpeg,.svg" class="sr-only" @change="replaceLogo">
            </label>
            <DlButton v-if="lab.logo_url" variant="ghost" size="sm" :loading="busy" @click="removeLogo">{{ t('central.labs.removeLogo') }}</DlButton>
            <span class="text-xs text-dl-muted">{{ errors.logo ?? t('central.labs.logoHint') }}</span>
          </div>
          <template #edit>
            <DlInput v-model="form.name" :label="t('central.labs.name')" :error="errors.name" />
            <DlInput v-model="form.website" type="url" :label="t('central.labs.website')" :error="errors.website" />
            <DlInput v-model="form.address" :label="t('central.labs.postalAddress')" :error="errors.address" />
            <div class="grid grid-cols-2 gap-2.5">
              <DlInput v-model="form.latitude" :label="t('central.labs.latitude')" inputmode="decimal" :error="errors.latitude" />
              <DlInput v-model="form.longitude" :label="t('central.labs.longitude')" inputmode="decimal" :error="errors.longitude" />
            </div>
          </template>
        </DlRecordSection>

        <DlRecordSection v-model:editing="editingNotes" :title="t('central.labs.notes')" :can-edit="canEditCard('notes')" :saving="busy" class="bg-dl-paper" @save="save" @cancel="reset">
          <p class="whitespace-pre-line">{{ lab.notes ?? '—' }}</p>
          <template #edit>
            <DlTextarea v-model="form.notes" :label="t('central.labs.notes')" :hint="t('central.labs.notesHint')" :rows="3" :error="errors.notes" />
          </template>
        </DlRecordSection>
      </div>

      <div class="flex flex-col gap-4">
        <DlRecordSection v-model:editing="editingContact" :title="t('central.labs.contact')" :can-edit="canEditCard('contact')" :saving="busy" class="bg-dl-paper" @save="save" @cancel="reset">
          <dl>
            <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.labs.email') }}</dt><dd>{{ lab.email ?? '—' }}</dd></div>
            <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.labs.phone') }}</dt><dd>{{ lab.phone ?? '—' }}</dd></div>
            <div :class="row"><dt class="flex-1 font-semibold">{{ t('central.labs.contactEmail') }}</dt><dd>{{ lab.contact_email ?? '—' }}</dd></div>
          </dl>
          <template #edit>
            <DlInput v-model="form.email" type="email" :label="t('central.labs.email')" :error="errors.email" />
            <DlInput v-model="form.phone" type="tel" :label="t('central.labs.phone')" :error="errors.phone" />
            <DlInput v-model="form.contact_email" type="email" :label="t('central.labs.contactEmail')" :error="errors.contact_email" />
            <p class="text-xs text-dl-muted">{{ t('central.labs.contactEditHint') }}</p>
          </template>
        </DlRecordSection>

        <DlRecordSection :title="t('central.labs.firstAdmin')" :can-edit="false" class="bg-dl-paper">
          <template v-if="lab.first_admin">
            <strong>{{ lab.first_admin.name }}</strong> · {{ lab.first_admin.email }}<br>
            <span class="text-xs text-dl-muted">{{ lab.first_admin.last_login_at ? t('central.labs.signedInOn', { date: d(new Date(lab.first_admin.last_login_at)) }) : t('central.labs.notSignedIn') }}</span>
            <div v-if="canEdit" class="mt-2 flex flex-wrap items-center gap-2">
              <DlButton variant="outline" size="sm" :loading="busy" @click="sendLink">{{ t('central.labs.sendLink') }}</DlButton>
              <span class="text-xs" :class="linkSent ? 'text-dl-fg' : 'text-dl-muted'">{{ linkSent ? t('central.labs.linkSent') : t('central.labs.sendLinkHint') }}</span>
            </div>
          </template>
          <template v-else>{{ t('central.labs.noAdmin') }}</template>
        </DlRecordSection>

        <DlRecordSection :title="t('central.labs.places')" :can-edit="false" class="bg-dl-paper">
          <strong>{{ lab.country?.name ?? '—' }}</strong>
          <template v-if="lab.copied"> · {{ t('central.labs.copiedPlaces', { regions: n(lab.copied.regions), wilayas: n(lab.copied.wilayas), communes: n(lab.copied.communes) }) }}</template>
          <p class="mt-1.5 text-xs text-dl-muted">{{ t('central.labs.placesHint') }}</p>
        </DlRecordSection>

        <DlRecordSection v-model:editing="editingLanguages" :title="t('central.labs.languages')" :can-edit="canEditCard('languages')" :saving="busy" class="bg-dl-paper" @save="save" @cancel="reset">
          {{ t('central.labs.language') }}: <strong>{{ lab.copied_languages.find(({ id }) => id === lab.language?.id)?.native_name ?? lab.language?.name ?? '—' }}</strong><br>
          {{ t('central.labs.copiedLanguages') }}: {{ lab.copied_languages.map(({ native_name }) => native_name).join(' · ') || '—' }}
          <p class="mt-1.5 text-xs text-dl-muted">{{ t('central.labs.languagesHint') }}</p>
          <template #edit>
            <DlSelect v-model="form.language_id" :label="t('central.labs.language')" :options="languageOptions" />
            <p class="text-xs" :class="errors.language_id ? 'text-dl-rejected' : 'text-dl-muted'">{{ errors.language_id ?? t('central.labs.languageEditHint') }}</p>
          </template>
        </DlRecordSection>
      </div>
    </div>
  </div>
</template>

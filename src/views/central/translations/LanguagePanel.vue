<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { languagesApi, type Language, type LanguageChanges } from '@/api/central/languages'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { useLanguageName } from './useLanguageName'

const props = defineProps<{ language: Language; languages: Language[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: []; deleted: [] }>()

const { t, n } = useI18n()
const auth = useAuthStore()
const languageName = useLanguageName()

const details = ref({ name: '', native_name: '', direction: 'ltr' as Language['direction'], locale: '' })
const editing = ref(false)
const confirmingDelete = ref(false)
const errors = ref<Record<string, string>>({})
const error = ref<string | null>(null)
const busy = ref(false)

const isFrench = computed(() => props.language.code === 'fr')
const canUpdate = computed(() => auth.can('languages.update'))
const canDelete = computed(() => auth.can('languages.delete') && !isFrench.value)
const nameOf = (code: string | null) => {
  if (!code) return '—'

  return languageName(code, props.languages.find((item) => item.code === code)?.name)
}
const directionOptions = computed(() => ['ltr', 'rtl'].map((value) => ({ value, label: t(`central.languages.direction.${value}`) })))

function reset(): void {
  const { name, native_name, direction, locale } = props.language
  details.value = { name, native_name, direction, locale }
  editing.value = false
  confirmingDelete.value = false
  errors.value = {}
  error.value = null
}

watch(() => props.language, reset, { immediate: true })

async function run(action: () => Promise<unknown>, done: () => void): Promise<void> {
  busy.value = true
  errors.value = {}
  error.value = null
  try {
    await action()
    done()
  } catch (failure) {
    errors.value = fieldErrors(failure)
    if (!Object.keys(errors.value).length) error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}

function saveDetails(): Promise<void> {
  const changes: LanguageChanges = { ...details.value }

  return run(() => languagesApi.update(props.language.code, changes), () => emit('changed'))
}

const switchActive = () => run(() => languagesApi.update(props.language.code, { is_active: !props.language.is_active }), () => emit('changed'))
const remove = () => run(() => languagesApi.remove(props.language.code), () => emit('deleted'))
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="nameOf(language.code)">
    <template #media>
      <span class="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] bg-dl-cobalt text-[15px] font-bold uppercase text-white">{{ language.code.slice(0, 2) }}</span>
    </template>
    <template #badges>
      <div class="flex flex-wrap gap-1.5">
        <DlBadge :tone="language.is_active ? 'success' : 'neutral'" dot size="sm">{{ t(`central.languages.status.${language.is_active ? 'active' : 'inactive'}`) }}</DlBadge>
        <DlBadge size="sm">{{ t(`central.languages.direction.${language.direction}`) }}</DlBadge>
      </div>
    </template>

    <div class="flex flex-col gap-3">
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5"><b class="font-display text-2xl font-extrabold">{{ n(language.texts_done) }}</b><span class="text-xs text-dl-muted">{{ t('central.languages.textsDone') }}</span></div>
        <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5"><b class="font-display text-2xl font-extrabold">{{ n(language.texts_missing) }}</b><span class="text-xs text-dl-muted">{{ t('central.languages.textsMissing') }}</span></div>
      </div>
      <DlButton
        v-if="language.texts_missing && !isFrench && auth.can('translations.show')"
        variant="dark"
        size="sm"
        :to="{ name: 'central-translations', query: { language: language.code, state: 'missing' } }"
      >{{ t('central.languages.translateMissing', { count: n(language.texts_missing) }) }}</DlButton>

      <DlRecordSection v-model:editing="editing" :title="t('central.languages.details')" :can-edit="canUpdate" :saving="busy" @save="saveDetails" @cancel="reset">
        {{ language.name }} · <span :dir="language.direction">{{ language.native_name }}</span><br>
        {{ t('central.languages.code') }}: {{ language.code }}<br>
        {{ t('central.languages.locale') }}: {{ language.locale }}
        <template #edit>
          <DlInput v-model="details.name" :label="t('central.languages.name')" :error="errors.name" />
          <DlInput v-model="details.native_name" :label="t('central.languages.nativeName')" :error="errors.native_name" />
          <DlSelect v-model="details.direction" :label="t('central.languages.directionLabel')" :options="directionOptions" />
          <DlInput v-model="details.locale" :label="t('central.languages.locale')" :error="errors.locale" />
        </template>
      </DlRecordSection>

      <DlRecordSection v-if="canUpdate && !isFrench" :title="t(`central.languages.status.${language.is_active ? 'active' : 'inactive'}`)" :can-edit="false">
        {{ t(language.is_active ? 'central.languages.activeHint' : 'central.languages.inactiveHint') }}
        <div class="mt-2"><DlButton variant="outline" size="sm" :loading="busy" @click="switchActive">{{ t(language.is_active ? 'central.languages.deactivate' : 'central.languages.activate') }}</DlButton></div>
      </DlRecordSection>

      <DlRecordSection v-if="canDelete" :title="t('common.actions.delete')" :can-edit="false">
        {{ language.texts_done ? t('central.languages.cannotDelete', { count: n(language.texts_done) }) : t('central.languages.canDelete') }}
        <div class="mt-2 flex gap-2">
          <DlButton v-if="!confirmingDelete" variant="outline" size="sm" :disabled="language.texts_done > 0" @click="confirmingDelete = true">{{ t('common.actions.delete') }}</DlButton>
          <template v-else>
            <DlButton variant="danger" size="sm" :loading="busy" @click="remove">{{ t('central.languages.deleteConfirm') }}</DlButton>
            <DlButton variant="ghost" size="sm" @click="confirmingDelete = false">{{ t('common.actions.cancel') }}</DlButton>
          </template>
        </div>
      </DlRecordSection>

      <p v-if="isFrench" class="text-xs text-dl-muted">{{ t('central.languages.frenchHint') }}</p>
    </div>
  </DlRecordPanel>
</template>

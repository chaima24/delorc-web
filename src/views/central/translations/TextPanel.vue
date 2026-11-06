<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import type { Language } from '@/api/central/languages'
import { translationsApi, type TextDetail, type TextToSave } from '@/api/central/translations'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useAuthStore } from '@/stores/auth'
import { useLanguageName } from './useLanguageName'

/** One key in every language, with who changed each text. French is edited here. */
const props = defineProps<{ textKey: string; languages: Language[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const { t, d } = useI18n()
const auth = useAuthStore()
const languageName = useLanguageName()

const detail = ref<TextDetail | null>(null)
const drafts = ref<Record<string, string>>({})
const errors = ref<Record<string, string>>({})
const error = ref<string | null>(null)
const busy = ref(false)

const canEdit = computed(() => auth.can('translations.update'))
const language = (code: string) => props.languages.find((item) => item.code === code)
const label = (code: string) => languageName(code, language(code)?.name)
const changed = (text: TextDetail['texts'][number]) => drafts.value[text.language] !== (text.value ?? '')
const changes = computed(() => detail.value?.texts.filter(changed) ?? [])

function reset(): void {
  drafts.value = Object.fromEntries((detail.value?.texts ?? []).map((text) => [text.language, text.value ?? '']))
  errors.value = {}
  error.value = null
}

async function load(): Promise<void> {
  detail.value = null
  error.value = null
  try {
    detail.value = await translationsApi.get(props.textKey)
    reset()
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
}

watch(() => props.textKey, load, { immediate: true })

function hint(text: TextDetail['texts'][number]): string | undefined {
  if (changed(text)) return t('central.translations.notSaved')
  if (text.updated_by) return t('central.translations.changedBy', { name: text.updated_by.name, date: d(new Date(text.updated_at!)) })
  if (text.value !== null) return undefined
  const fallback = language(text.language)?.fallback ?? 'fr'

  return t('central.translations.fallsBackTo', { language: label(fallback) })
}

async function save(): Promise<void> {
  const texts: TextToSave[] = changes.value.map((text) => ({
    language: text.language,
    key: props.textKey,
    value: drafts.value[text.language] || null,
  }))
  busy.value = true
  errors.value = {}
  error.value = null
  try {
    await translationsApi.save(texts)
    await load()
    emit('saved')
  } catch (failure) {
    const fields = fieldErrors(failure)
    errors.value = Object.fromEntries(texts.flatMap((text, index) => {
      const message = fields[`texts.${index}.value`]

      return message ? [[text.language, message]] : []
    }))
    if (!Object.keys(errors.value).length) error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="textKey">
    <template #badges>
      <div v-if="detail"><DlBadge size="sm">{{ t(`central.translations.usedIn.${detail.used_in}`) }}</DlBadge></div>
    </template>

    <div class="flex flex-col gap-3">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <template v-if="detail">
        <section v-if="detail.note" class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px] text-dl-body">
          <h3 class="mb-1 text-sm font-semibold text-dl-fg">{{ t('central.translations.note') }}</h3>
          {{ detail.note }}
        </section>
        <DlTextarea
          v-for="text in detail.texts"
          :key="text.language"
          v-model="drafts[text.language]"
          :label="text.language === 'fr' ? t('central.translations.reference') : label(text.language)"
          :dir="language(text.language)?.direction"
          :rows="2"
          :disabled="!canEdit"
          :changed="changed(text)"
          :hint="hint(text)"
          :error="errors[text.language]"
        />
        <div v-if="canEdit" class="flex gap-2">
          <DlButton variant="primary" size="sm" :disabled="!changes.length" :loading="busy" @click="save">{{ t('common.actions.save') }}</DlButton>
          <DlButton variant="outline" size="sm" @click="reset">{{ t('common.actions.cancel') }}</DlButton>
        </div>
      </template>
    </div>
  </DlRecordPanel>
</template>

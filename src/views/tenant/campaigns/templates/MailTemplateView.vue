<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  deleteMailTemplate, deleteMailTemplateFile, fetchMailTemplate, testMailTemplate, updateMailTemplate, uploadMailTemplateImage,
  type MailTemplate,
} from '@/api/tenant/campaignMessages'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import MailEditor from '../messages/MailEditor.vue'
import MailFilesCard from '../messages/MailFilesCard.vue'
import MailPreview from '../messages/MailPreview.vue'
import { CHANNEL_ICON, useMessageText } from '../messages/messageDisplay'
import { useBrandOptions } from './useBrandOptions'

// A template's page: name, brand, subject, the same editor as a message, files copied into each new message, on / off.
// Changing it never touches the messages already made from it. Mockup frame 11.
const props = defineProps<{ id: string }>()
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useMessageText()
const { brands } = useBrandOptions()
const canEdit = computed(() => auth.can('mail-templates.update'))

const NONE = 0
const template = ref<MailTemplate | null>(null)
const failed = ref(false)
const form = ref({ label: '', brand_id: NONE, subject: '', body: '', is_active: true })
const errors = ref<Record<string, string>>({})
function take(value: MailTemplate) {
  template.value = value
  form.value = { label: value.label, brand_id: value.brand?.id ?? NONE, subject: value.subject ?? '', body: value.body ?? '', is_active: value.is_active }
  errors.value = {}
}
async function load() {
  failed.value = false
  try {
    take(await fetchMailTemplate(Number(props.id)))
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, load, { immediate: true })

const isSms = computed(() => template.value?.channel === 'sms')
const brandItems = computed(() => [{ value: NONE, label: t('campaignMessages.templates.allBrands') }, ...brands.value])
const brand = computed({ get: () => form.value.brand_id, set: value => { form.value.brand_id = Number(value ?? NONE) } })
const dirty = computed(() => {
  const row = template.value
  if (!row) return false
  const f = form.value
  return f.label !== row.label || f.brand_id !== (row.brand?.id ?? NONE) || f.subject !== (row.subject ?? '') || f.body !== (row.body ?? '') || f.is_active !== row.is_active
})

const busy = ref<string | null>(null)
async function run<T>(key: string, action: () => Promise<T>, done?: string): Promise<T | null> {
  busy.value = key
  try {
    const result = await action()
    if (done) toast.success(done)
    return result
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
    return null
  }
  finally {
    busy.value = null
  }
}
async function save(quiet = false) {
  const f = form.value
  const saved = await run('save', () => updateMailTemplate(template.value!.id, {
    label: f.label, brand_id: f.brand_id || null, subject: isSms.value ? null : f.subject || null, body: f.body, is_active: f.is_active,
  }), quiet ? undefined : t('studio.list.toast.saved'))
  if (saved) take(saved)
  return !!saved
}
async function test() {
  const ok = await confirm({ title: t('campaignMessages.test.title'), text: t('campaignMessages.test.text', { email: auth.user?.email ?? '' }), confirmButtonText: t('campaignMessages.test.send'), icon: 'question' })
  if (!ok || (dirty.value && !(await save(true)))) return
  await run('test', () => testMailTemplate(template.value!.id), t('campaignMessages.test.done', { email: auth.user?.email ?? '' }))
}
async function remove() {
  const ok = await confirm({ title: t('campaignMessages.templates.deleteTitle', { name: template.value!.label }), text: t('campaignMessages.templates.deleteText', template.value!.messages_count ?? 0), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  if (await run('delete', () => deleteMailTemplate(template.value!.id), t('studio.list.toast.deleted')) !== null) router.push({ name: 'tenant-mail-templates' })
}
async function addFiles(files: File[]) {
  const saved = await run('files', () => updateMailTemplate(template.value!.id, { attachments: files }))
  if (saved && template.value) template.value = { ...template.value, attachments: saved.attachments }
}
async function removeFile(fileId: number) {
  const saved = await run('files', () => deleteMailTemplateFile(template.value!.id, fileId))
  if (saved && template.value) template.value = { ...template.value, attachments: saved.attachments }
}
const uploadImage = async (file: File) => (await uploadMailTemplateImage(template.value!.id, file)).url
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('campaignMessages.templates.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-mail-templates' }">{{ t('campaignMessages.templates.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!template">
      <DlSkeleton class="h-24 rounded-3xl" />
      <div class="grid gap-4 lg:grid-cols-2"><DlSkeleton class="h-96 rounded-3xl" /><DlSkeleton class="h-96 rounded-3xl" /></div>
    </template>

    <template v-else>
      <div class="flex flex-col gap-2">
        <nav class="flex items-center gap-1.5 text-[13px] text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
          <RouterLink :to="{ name: 'tenant-mail-templates' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('campaignMessages.templates.title') }}</RouterLink>
        </nav>
        <div class="flex flex-wrap items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-dl-cobalt/10 text-dl-cobalt"><DlIcon :icon="CHANNEL_ICON[template.channel]" :size="20" /></span>
          <h1 class="min-w-0 font-display text-[24px] font-extrabold leading-tight tracking-[-0.02em] md:text-[28px]">{{ template.label }}</h1>
          <DlBadge :tone="template.is_active ? 'success' : 'neutral'" dot>{{ template.is_active ? t('campaignMessages.templates.active') : t('campaignMessages.templates.inactive') }}</DlBadge>
          <div class="ms-auto flex flex-wrap gap-2">
            <DlButton v-if="!isSms" variant="outline" icon="tabler-mail-forward" :loading="busy === 'test'" @click="test">{{ t('campaignMessages.test.button') }}</DlButton>
            <DlButton v-if="auth.can('mail-templates.delete')" variant="ghost" icon="tabler-trash" :loading="busy === 'delete'" @click="remove">{{ t('common.actions.delete') }}</DlButton>
            <DlButton v-if="canEdit" variant="dark" :disabled="!dirty" :loading="busy === 'save'" @click="save()">{{ t('common.actions.save') }}</DlButton>
          </div>
        </div>
        <span class="text-[13px] text-dl-muted">{{ t('campaignMessages.templates.pageHint', { count: n(template.messages_count ?? 0), date: text.date(template.created_at) }, template.messages_count ?? 0) }}</span>
      </div>

      <div class="grid items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div class="flex min-w-0 flex-col gap-4">
          <div class="grid gap-3 sm:grid-cols-[1fr_220px]">
            <DlInput v-model="form.label" :label="t('campaignMessages.templates.name')" :error="errors.label" :disabled="!canEdit" />
            <DlSelect v-model="brand" :label="t('campaignMessages.templates.brand')" :options="brandItems" :disabled="!canEdit" />
          </div>
          <MailEditor v-if="!isSms" v-model="form.subject" single :label="t('campaignMessages.fields.subject')" :error="errors.subject" :disabled="!canEdit" />
          <MailEditor v-model="form.body" :label="t('campaignMessages.fields.body')" :plain="isSms" :disabled="!canEdit" :error="errors.body" :upload="isSms ? undefined : uploadImage" />
          <MailFilesCard v-if="!isSms" :files="template.attachments ?? []" :can-edit="canEdit" :busy="busy === 'files'" :hint="t('campaignMessages.templates.filesHint')" @add="addFiles" @remove="removeFile" />
          <section class="flex items-center gap-4 rounded-3xl bg-dl-paper p-4 md:p-5">
            <div class="min-w-0 flex-1">
              <strong class="text-sm">{{ t('campaignMessages.templates.active') }}</strong>
              <p class="text-[13px] text-dl-muted">{{ t('campaignMessages.templates.activeHint') }}</p>
            </div>
            <DlSwitch v-if="canEdit" v-model="form.is_active" label="" :aria-label="t('campaignMessages.templates.active')" />
          </section>
          <p class="text-xs text-dl-muted">{{ t('campaignMessages.templates.copyNote', template.messages_count ?? 0) }}</p>
        </div>
        <MailPreview :channel="template.channel" :subject="form.subject" :body="form.body" :files="template.attachments?.length" />
      </div>
    </template>
  </div>
</template>

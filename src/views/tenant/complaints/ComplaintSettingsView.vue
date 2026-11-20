<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  createComplaintCategory, deleteComplaintCategory, fetchComplaintCategories, fetchComplaintSettings, saveComplaintSettings,
  updateComplaintCategory, type ComplaintCategory,
} from '@/api/tenant/complaints'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'

// Réclamations › Réglages (`complaints.handle`): the lab's categories, in order, and the anonymous switch. A used
// category is turned off instead of deleted. Mockup: complaints-mockups/Complaints.html frame 6.
const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

const rows = ref<ComplaintCategory[] | null>(null)
const anonymous = ref<boolean | null>(null)
async function load() {
  rows.value = await fetchComplaintCategories()
  anonymous.value = (await fetchComplaintSettings()).anonymous_allowed
}
onMountedAndFocus(load)

// One input open at a time: a new category, or the one being renamed.
const editing = ref<{ id: number | null; name: string; error: string } | null>(null)

async function run(action: () => Promise<unknown>, done = t('studio.list.toast.saved')) {
  try {
    await action()
    await load()
    toast.success(done)
    return true
  }
  catch (error) {
    const fields = fieldErrors(error)
    if (editing.value && fields.name) editing.value.error = fields.name
    else toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
    return false
  }
}
async function saveEditing() {
  const row = editing.value
  if (!row) return
  const ok = await run(() => (row.id ? updateComplaintCategory(row.id, { name: row.name }) : createComplaintCategory({ name: row.name })))
  if (ok) editing.value = null
}
const move = (row: ComplaintCategory, by: number) => run(() => updateComplaintCategory(row.id, { sort: row.sort + by }))
const toggle = (row: ComplaintCategory, value: boolean) => run(() => updateComplaintCategory(row.id, { is_active: value }))
const setAnonymous = (value: boolean) => run(() => saveComplaintSettings(value))
async function remove(row: ComplaintCategory) {
  const ok = await confirm({ title: t('complaints.settings.deleteTitle', { name: row.name }), text: t('complaints.settings.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (ok) await run(() => deleteComplaintCategory(row.id), t('studio.list.toast.deleted'))
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-sm text-dl-muted">{{ t('nav.workspaces.complaints') }}</span>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('complaints.settings.title') }}</h1>
    </div>
    <DlSkeleton v-if="!rows || anonymous === null" class="h-64 rounded-3xl" />
    <div v-else class="grid items-start gap-4 md:grid-cols-2">
      <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('complaints.settings.categories')">
        <header class="flex items-center gap-2">
          <h2 class="flex-1 text-[15px] font-semibold">{{ t('complaints.settings.categories') }}</h2>
          <DlButton size="sm" variant="outline" icon="tabler-plus" @click="editing = { id: null, name: '', error: '' }">{{ t('complaints.settings.add') }}</DlButton>
        </header>
        <ul class="flex flex-col">
          <li v-for="(row, i) in rows" :key="row.id" class="flex items-center gap-2 border-b border-dl-line-soft py-1.5 text-[13.5px] last:border-b-0">
            <form v-if="editing?.id === row.id" class="flex flex-1 items-start gap-2" @submit.prevent="saveEditing">
              <div class="flex-1"><DlInput v-model="editing.name" :label="t('complaints.settings.name')" hide-label :error="editing.error" /></div>
              <DlButton type="submit" size="sm" variant="primary">{{ t('common.actions.save') }}</DlButton>
              <DlIconButton icon="tabler-x" variant="ghost" :label="t('common.actions.cancel')" @click="editing = null" />
            </form>
            <template v-else>
              <span class="flex flex-col">
                <DlIconButton icon="tabler-chevron-up" variant="ghost" :size="22" :label="t('complaints.settings.up', { name: row.name })" :disabled="i === 0" @click="move(row, -1)" />
                <DlIconButton icon="tabler-chevron-down" variant="ghost" :size="22" :label="t('complaints.settings.down', { name: row.name })" :disabled="i === rows.length - 1" @click="move(row, 1)" />
              </span>
              <span class="min-w-0 flex-1" :class="!row.is_active && 'text-dl-muted'">{{ row.name }}</span>
              <span v-if="row.complaints_count" class="whitespace-nowrap text-xs text-dl-muted">{{ t('complaints.settings.used', { count: row.complaints_count }, row.complaints_count) }}</span>
              <DlIconButton icon="tabler-pencil" variant="ghost" :size="28" :label="t('complaints.settings.rename', { name: row.name })" @click="editing = { id: row.id, name: row.name, error: '' }" />
              <DlIconButton v-if="!row.complaints_count" icon="tabler-trash" variant="ghost" :size="28" :label="t('complaints.settings.delete', { name: row.name })" @click="remove(row)" />
              <DlSwitch :model-value="row.is_active" :label="''" :aria-label="t('complaints.settings.active', { name: row.name })" @update:model-value="value => toggle(row, value)" />
            </template>
          </li>
        </ul>
        <form v-if="editing && editing.id === null" class="flex items-start gap-2" @submit.prevent="saveEditing">
          <div class="flex-1"><DlInput v-model="editing.name" :label="t('complaints.settings.name')" hide-label :placeholder="t('complaints.settings.newName')" :error="editing.error" /></div>
          <DlButton type="submit" size="sm" variant="primary">{{ t('complaints.settings.add') }}</DlButton>
          <DlIconButton icon="tabler-x" variant="ghost" :label="t('common.actions.cancel')" @click="editing = null" />
        </form>
      </section>
      <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('complaints.settings.anonymous')">
        <DlSwitch :model-value="anonymous" :label="t('complaints.settings.anonymous')" @update:model-value="setAnonymous" />
        <p class="text-[13px] text-dl-muted">{{ t('complaints.settings.anonymousHint') }}</p>
        <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-xs text-dl-muted">{{ t('complaints.settings.whoHandles') }}</p>
      </section>
    </div>
  </div>
</template>

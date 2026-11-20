<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  COMPETITIVE_LISTS, createCompetitiveType, deleteCompetitiveType, fetchCompetitiveTypes, updateCompetitiveType,
  type CompetitiveList, type CompetitiveType,
} from '@/api/tenant/competitive'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useCompetitiveText } from './competitiveDisplay'

// Veille concurrentielle › Réglages: the five lists offered in the notes, each with its order and its switch.
// « Autre » (free text) is always offered besides. An item used by a note is turned off instead of deleted. Mockup frame 9.
const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const text = useCompetitiveText()
const canAdd = computed(() => auth.can('competitive-types.create'))
const canEdit = computed(() => auth.can('competitive-types.update'))
const canDelete = computed(() => auth.can('competitive-types.delete'))

const rows = ref<CompetitiveType[] | null>(null)
async function load() {
  rows.value = await fetchCompetitiveTypes()
}
onMountedAndFocus(load)
const of = (list: CompetitiveList) => (rows.value ?? []).filter(row => row.type === list).sort((a, b) => a.sort - b.sort)

// One input open at a time: a new item in a list, or the item being renamed.
const editing = ref<{ list: CompetitiveList; id: number | null; content: string; error: string } | null>(null)
const openAdd = (list: CompetitiveList) => { editing.value = { list, id: null, content: '', error: '' } }
const openRename = (row: CompetitiveType) => { editing.value = { list: row.type, id: row.id, content: row.content, error: '' } }

async function run(action: () => Promise<unknown>, done = t('studio.list.toast.saved')) {
  try {
    await action()
    await load()
    toast.success(done)
    return true
  }
  catch (error) {
    const fields = fieldErrors(error)
    if (editing.value && fields.content) editing.value.error = fields.content
    else toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
    return false
  }
}
async function saveEditing() {
  const row = editing.value
  if (!row) return
  const ok = await run(() => (row.id ? updateCompetitiveType(row.id, { content: row.content }) : createCompetitiveType({ type: row.list, content: row.content })))
  if (ok) editing.value = null
}
const move = (row: CompetitiveType, by: number) => run(() => updateCompetitiveType(row.id, { sort: row.sort + by }))
const toggle = (row: CompetitiveType, value: boolean) => run(() => updateCompetitiveType(row.id, { is_active: value }))
async function remove(row: CompetitiveType) {
  const ok = await confirm({ title: t('competitive.settings.deleteTitle', { name: row.content }), text: t('competitive.settings.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (ok) await run(() => deleteCompetitiveType(row.id), t('studio.list.toast.deleted'))
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-sm text-dl-muted">{{ t('nav.workspaces.competitive') }}</span>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('competitive.settings.title') }}</h1>
      <p class="text-[13px] text-dl-muted">{{ t('competitive.settings.subtitle') }}</p>
    </div>
    <DlSkeleton v-if="!rows" class="h-64 rounded-3xl" />
    <div v-else class="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      <section v-for="list in COMPETITIVE_LISTS" :key="list" class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="text.list(list)">
        <header class="flex items-center gap-2">
          <h2 class="flex-1 text-[15px] font-semibold">{{ text.list(list) }}</h2>
          <DlButton v-if="canAdd" size="sm" variant="outline" icon="tabler-plus" @click="openAdd(list)">{{ t('competitive.settings.add') }}</DlButton>
        </header>
        <ul class="flex flex-col">
          <li v-for="(row, i) in of(list)" :key="row.id" class="flex items-center gap-2 border-b border-dl-line-soft py-1.5 text-[13.5px] last:border-b-0">
            <form v-if="editing?.id === row.id" class="flex flex-1 items-start gap-2" @submit.prevent="saveEditing">
              <div class="flex-1"><DlInput v-model="editing.content" :label="t('competitive.settings.item')" hide-label :error="editing.error" /></div>
              <DlButton type="submit" size="sm" variant="primary">{{ t('common.actions.save') }}</DlButton>
              <DlIconButton icon="tabler-x" variant="ghost" :label="t('common.actions.cancel')" @click="editing = null" />
            </form>
            <template v-else>
              <span v-if="canEdit" class="flex flex-col">
                <DlIconButton icon="tabler-chevron-up" variant="ghost" :size="22" :label="t('competitive.settings.up', { name: row.content })" :disabled="i === 0" @click="move(row, -1)" />
                <DlIconButton icon="tabler-chevron-down" variant="ghost" :size="22" :label="t('competitive.settings.down', { name: row.content })" :disabled="i === of(list).length - 1" @click="move(row, 1)" />
              </span>
              <span class="min-w-0 flex-1" :class="!row.is_active && 'text-dl-muted'">{{ row.content }}</span>
              <span v-if="row.notes_count" class="whitespace-nowrap text-xs text-dl-muted">{{ t('competitive.settings.used', { count: row.notes_count }, row.notes_count) }}</span>
              <DlIconButton v-if="canEdit" icon="tabler-pencil" variant="ghost" :size="28" :label="t('competitive.settings.rename', { name: row.content })" @click="openRename(row)" />
              <DlIconButton v-if="canDelete && !row.notes_count" icon="tabler-trash" variant="ghost" :size="28" :label="t('competitive.settings.delete', { name: row.content })" @click="remove(row)" />
              <DlSwitch :model-value="row.is_active" :label="''" :aria-label="t('competitive.settings.active', { name: row.content })" :disabled="!canEdit" @update:model-value="value => toggle(row, value)" />
            </template>
          </li>
          <li v-if="!of(list).length" class="py-1.5 text-[13px] text-dl-muted">{{ t('competitive.settings.empty') }}</li>
        </ul>
        <form v-if="editing && editing.list === list && editing.id === null" class="flex items-start gap-2" @submit.prevent="saveEditing">
          <div class="flex-1"><DlInput v-model="editing.content" :label="t('competitive.settings.item')" hide-label :placeholder="t('competitive.settings.newItem')" :error="editing.error" /></div>
          <DlButton type="submit" size="sm" variant="primary">{{ t('competitive.settings.add') }}</DlButton>
          <DlIconButton icon="tabler-x" variant="ghost" :label="t('common.actions.cancel')" @click="editing = null" />
        </form>
      </section>
    </div>
    <p class="text-xs text-dl-muted">{{ t('competitive.settings.note') }}</p>
  </div>
</template>

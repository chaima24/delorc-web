<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import DlButton from './DlButton.vue'
import DlIcon from './DlIcon.vue'

/**
 * One part of a record in a reading-mode panel: a short summary, and "Edit" to turn just this
 * part into fields with its own Cancel / Save. Read: default slot. Edit: `#edit` slot.
 * `editTo` makes Edit open a page instead (for a part too big to edit in place).
 */
withDefaults(defineProps<{
  title: string
  icon?: string
  canEdit?: boolean
  saving?: boolean
  saveLabel?: string
  editTo?: RouteLocationRaw
}>(), {
  canEdit: true,
  saving: false,
})

const editing = defineModel<boolean>('editing', { default: false })
const emit = defineEmits<{ save: []; cancel: [] }>()
const { t } = useI18n()
</script>

<template>
  <section
    class="rounded-2xl border"
    :class="editing ? 'border-2 border-dl-fg' : 'border-dl-line'"
    :aria-label="title"
  >
    <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
      <span
        v-if="icon"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
        :class="editing ? 'bg-dl-ink text-dl-signal' : 'bg-dl-line-soft text-dl-body'"
      >
        <DlIcon :icon="icon" :size="17" />
      </span>
      <h3 class="flex-1 text-sm font-semibold">{{ title }}</h3>
      <DlButton v-if="canEdit && !editing" variant="outline" size="sm" icon="tabler-pencil" :to="editTo" @click="editTo || (editing = true)">
        {{ t('common.actions.edit') }}
      </DlButton>
    </header>

    <div v-if="!editing" class="px-3.5 pb-3 text-[13px] text-dl-body">
      <slot />
    </div>
    <form v-else class="flex flex-col gap-3.5 px-3.5 pb-3.5 pt-1.5" @submit.prevent="emit('save')">
      <slot name="edit" />
      <div class="flex justify-end gap-2">
        <DlButton variant="outline" size="sm" @click="emit('cancel')">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton type="submit" variant="dark" size="sm" :loading="saving">{{ saveLabel ?? t('common.actions.save') }}</DlButton>
      </div>
    </form>
  </section>
</template>

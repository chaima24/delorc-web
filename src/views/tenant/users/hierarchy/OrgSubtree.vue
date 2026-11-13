<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import DlAvatar from '@/components/DlAvatar.vue'
import DlIcon from '@/components/DlIcon.vue'
import { useUserText } from '../userDisplay'
import { peopleUnder } from './orgTree'
import { useOrgTree } from './useOrgTree'

// The people under someone, as a small tree. The first `openLevels` levels are open; deeper
// branches open on click.
defineOptions({ name: 'OrgSubtree' })
const props = withDefaults(defineProps<{ userId: number; level?: number; openLevels?: number }>(), { level: 0, openLevels: 2 })
const { t, n } = useI18n()
const text = useUserText()
const { tree } = useOrgTree()

const people = computed(() => (tree.value.childrenOf.get(props.userId) ?? []).map(id => tree.value.byId.get(id)!).filter(Boolean))
const opened = ref(new Set<number>())
const isOpen = (id: number) => props.level + 1 < props.openLevels ? !opened.value.has(id) : opened.value.has(id)
function toggle(id: number) {
  const next = new Set(opened.value)
  if (!next.delete(id)) next.add(id)
  opened.value = next
}
const under = (id: number) => peopleUnder(tree.value, id).size
</script>

<template>
  <ul class="flex flex-col gap-1" :class="level > 0 && 'ms-3 border-s-2 border-dl-line ps-2.5'">
    <li v-for="person in people" :key="person.id" class="flex flex-col gap-1">
      <span class="flex items-center gap-2 text-[13px]">
        <button
          v-if="under(person.id)"
          type="button"
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-dl-muted hover:bg-dl-line-soft hover:text-dl-fg"
          :aria-label="isOpen(person.id) ? t('users.hierarchy.collapse') : t('users.hierarchy.expand')"
          :aria-expanded="isOpen(person.id)"
          @click="toggle(person.id)"
        >
          <DlIcon :icon="isOpen(person.id) ? 'tabler-chevron-down' : 'tabler-chevron-right'" :size="14" class="rtl:-scale-x-100" />
        </button>
        <span v-else class="w-6 shrink-0" />
        <DlAvatar :name="person.full_name" :src="person.avatar?.url" size="sm" />
        <span class="flex min-w-0 flex-1 flex-col">
          <RouterLink :to="{ name: 'tenant-user-detail', params: { id: person.id } }" class="truncate font-semibold text-dl-fg no-underline hover:underline">{{ person.full_name }}</RouterLink>
          <span class="truncate text-xs text-dl-muted">{{ text.role(person) }}</span>
        </span>
        <span v-if="under(person.id)" class="shrink-0 whitespace-nowrap text-xs text-dl-muted">{{ t('users.hierarchy.people', { count: n(under(person.id)) }, under(person.id)) }}</span>
      </span>
      <OrgSubtree v-if="under(person.id) && isOpen(person.id)" :user-id="person.id" :level="level + 1" :open-levels="openLevels" />
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlIcon from '@/components/DlIcon.vue'
import { STATUS_TONES, accountStatus, useUserText } from '../userDisplay'
import { HIERARCHY, type HierarchyContext } from './hierarchyContext'
import { peopleUnder } from './orgTree'

// One person in the tree. Someone with two managers has a box under each of them;
// `managerId` is the manager this box sits under (none at the top).
defineOptions({ name: 'HierarchyNode' })
const props = defineProps<{ id: number; managerId?: number | null }>()
const { t, n } = useI18n()
const text = useUserText()
const ctx = inject(HIERARCHY) as HierarchyContext

const user = computed(() => ctx.tree.value.byId.get(props.id)!)
const children = computed(() => (ctx.tree.value.childrenOf.get(props.id) ?? []).filter(id => ctx.visible.value.has(id)))
const open = computed(() => ctx.expanded.value.has(props.id))
const shown = computed(() => (ctx.showAll.value.has(props.id) ? children.value : children.value.slice(0, ctx.pageSize)))
const status = computed(() => accountStatus(user.value))
// The territory joins this line with its module.
const sub = computed(() => [text.role(user.value), text.teams(user.value)].filter(part => part && part !== '—').join(' · '))
const count = computed(() => (children.value.length ? peopleUnder(ctx.tree.value, props.id).size : 0))
const managerCount = computed(() => ctx.tree.value.managersOf.get(props.id)?.length ?? 0)
const isDropTarget = computed(() => ctx.dropOn.value === props.id)
const isDragged = computed(() => ctx.dragged.value?.id === props.id && ctx.dragged.value.from === (props.managerId ?? null))
</script>

<template>
  <li role="treeitem" :aria-expanded="children.length ? open : undefined" :aria-selected="ctx.selectedId.value === id" class="flex flex-col gap-1.5">
    <div
      :data-user="id"
      class="flex min-h-[54px] cursor-pointer items-center gap-2.5 rounded-2xl border bg-dl-paper px-2.5 py-2 text-[13px] transition"
      :class="[
        ctx.selectedId.value === id ? 'border-transparent bg-dl-signal-soft ring-[1.5px] ring-dl-fg ring-inset' : 'border-dl-line hover:bg-dl-mist',
        ctx.hits.value.has(id) && ctx.selectedId.value !== id && 'ring-2 ring-dl-cobalt ring-inset',
        isDropTarget && 'ring-[3px] ring-dl-signal',
        isDragged && 'border-dashed opacity-45',
      ]"
      :draggable="ctx.canDrag.value"
      @click="ctx.open(id)"
      @dragstart="ctx.dragStart(id, managerId ?? null, $event)"
      @dragend="ctx.dragEnd()"
      @dragover="ctx.dragOver(id, $event)"
      @dragleave="ctx.dragLeave(id)"
      @drop.prevent="ctx.drop(id)"
    >
      <button
        v-if="children.length"
        type="button"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-dl-muted hover:bg-dl-line-soft hover:text-dl-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
        :aria-label="open ? t('users.hierarchy.collapse') : t('users.hierarchy.expand')"
        @click.stop="ctx.toggle(id)"
      >
        <DlIcon :icon="open ? 'tabler-chevron-down' : 'tabler-chevron-right'" :size="16" class="rtl:-scale-x-100" />
      </button>
      <span v-else class="w-7 shrink-0" />
      <DlAvatar :name="user.full_name" :src="user.avatar?.url" size="sm" :tone="status === 'inactive' ? 'neutral' : 'cobalt'" />
      <span class="flex min-w-0 flex-1 flex-col">
        <strong class="truncate font-semibold">{{ user.full_name }}</strong>
        <span class="truncate text-xs text-dl-muted">{{ sub }}</span>
      </span>
      <DlBadge v-if="managerCount > 1" size="sm" class="max-md:hidden">{{ t('users.hierarchy.managerCount', { count: n(managerCount) }) }}</DlBadge>
      <DlBadge v-if="status !== 'active'" size="sm" dot :tone="STATUS_TONES[status]">{{ text.status(user) }}</DlBadge>
      <span v-if="count" class="shrink-0 whitespace-nowrap text-xs text-dl-muted">{{ t('users.hierarchy.people', { count: n(count) }, count) }}</span>
    </div>

    <ul v-if="children.length && open" role="group" class="ms-3.5 flex flex-col gap-1.5 border-s-2 border-dl-line ps-2.5 md:ms-[22px] md:ps-4">
      <HierarchyNode v-for="child in shown" :key="child" :id="child" :manager-id="id" />
      <li v-if="shown.length < children.length">
        <button type="button" class="px-2 py-1 text-xs font-semibold text-dl-cobalt hover:underline" @click="ctx.showAll.value = new Set([...ctx.showAll.value, id])">
          {{ t('users.hierarchy.more', { count: n(children.length - shown.length) }) }}
        </button>
      </li>
    </ul>
  </li>
</template>

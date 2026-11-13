<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TenantUser } from '@/api/tenant/users'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useAuthStore } from '@/stores/auth'
import { accountStatus, currentTeams, userRole } from '../userDisplay'
import HierarchyNode from './HierarchyNode.vue'
import { HIERARCHY } from './hierarchyContext'
import { peopleAbove, peopleUnder, visibleFor } from './orgTree'
import { useOrgTree } from './useOrgTree'

// Users › Hierarchy: the whole lab as a tree that opens and closes. Same filters as the list.
// Drag a box onto another to change its manager (desktop). Mockup: studio-mockups/Hierarchy.html
const props = defineProps<{
  search: string
  role: string | null
  team: number | null
  /** Status filter of the list: current · active · invited · not_invited · inactive · all */
  account: string
  selectedId: number | null
  /** Open the branches down to this person and scroll to them. */
  focusId?: number | null
}>()
const emit = defineEmits<{ open: [user: TenantUser]; move: [user: TenantUser, managerId: number, fromManagerId: number | null] }>()
const { t, n } = useI18n()
const auth = useAuthStore()
const { people, tree } = useOrgTree()

function inAccount(user: TenantUser) {
  const status = accountStatus(user)
  if (props.account === 'all') return true
  if (props.account === 'current') return status !== 'inactive'
  return status === props.account
}
const words = computed(() => props.search.trim().toLowerCase().split(/\s+/).filter(Boolean))
function found(user: TenantUser) {
  const haystack = `${user.full_name} ${user.email} ${user.phone ?? ''}`.toLowerCase()
  return words.value.every(word => haystack.includes(word))
}
const filtered = computed(() => !!(words.value.length || props.role || props.team || props.account !== 'all'))
const matches = (user: TenantUser) => inAccount(user)
  && (!props.role || userRole(user) === props.role)
  && (!props.team || currentTeams(user).some(team => team.id === props.team))
  && found(user)

const visible = computed(() => (filtered.value ? visibleFor(tree.value, matches) : new Set(tree.value.byId.keys())))
const hits = computed(() => (words.value.length ? new Set([...tree.value.byId.values()].filter(matches).map(user => user.id)) : new Set<number>()))
const roots = computed(() => tree.value.roots.filter(id => visible.value.has(id)))
const alone = computed(() => tree.value.alone.filter(id => visible.value.has(id)))

const expanded = ref(new Set<number>())
const showAll = ref(new Set<number>())
function expandDefault() {
  // The top of the tree and the level under it.
  expanded.value = new Set(tree.value.roots.flatMap(id => [id, ...(tree.value.childrenOf.get(id) ?? [])]))
}
function expandAll() {
  expanded.value = new Set([...tree.value.childrenOf.keys()].filter(id => visible.value.has(id)))
}
watch(() => people.loaded.value, loaded => { if (loaded && !expanded.value.size) expandDefault() }, { immediate: true })
// A search or filter opens every branch that leads to a match.
watch([words, () => props.role, () => props.team], () => {
  if (words.value.length || props.role || props.team) expandAll()
})

async function focus(id: number | null | undefined) {
  if (!id || !tree.value.byId.has(id)) return
  expanded.value = new Set([...expanded.value, ...peopleAbove(tree.value, id)])
  await nextTick()
  document.querySelector(`[data-user="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
watch([() => props.focusId, () => people.loaded.value], () => focus(props.focusId), { immediate: true })

// Drag and drop: desktop pointer only, and only for people allowed to change managers.
const media = window.matchMedia('(min-width: 1024px) and (pointer: fine)')
const desktop = ref(media.matches)
const onMedia = (event: MediaQueryListEvent) => { desktop.value = event.matches }
media.addEventListener('change', onMedia)
onBeforeUnmount(() => media.removeEventListener('change', onMedia))
const canDrag = computed(() => desktop.value && auth.can('users.update'))
const dragged = ref<{ id: number; from: number | null } | null>(null)
const dropOn = ref<number | null>(null)
const forbidden = computed(() => (dragged.value ? peopleUnder(tree.value, dragged.value.id) : new Set<number>()))
// Not on themselves, not under one of their own people, not on someone already their manager.
const canDropOn = (id: number) => dragged.value !== null && id !== dragged.value.id
  && !forbidden.value.has(id) && !(tree.value.managersOf.get(dragged.value.id) ?? []).includes(id)

provide(HIERARCHY, {
  tree,
  visible,
  hits,
  expanded,
  showAll,
  pageSize: 30,
  selectedId: computed(() => props.selectedId),
  canDrag,
  dragged,
  dropOn,
  open: id => emit('open', tree.value.byId.get(id)!),
  toggle: id => {
    const next = new Set(expanded.value)
    if (!next.delete(id)) next.add(id)
    expanded.value = next
  },
  dragStart: (id, from, event) => {
    if (!canDrag.value) return
    dragged.value = { id, from }
    event.dataTransfer?.setData('text/plain', String(id))
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  },
  dragEnd: () => {
    dragged.value = null
    dropOn.value = null
  },
  dragOver: (id, event) => {
    if (!canDropOn(id)) return
    event.preventDefault()
    dropOn.value = id
  },
  dragLeave: id => { if (dropOn.value === id) dropOn.value = null },
  drop: id => {
    const from = dragged.value?.from ?? null
    const person = dragged.value ? tree.value.byId.get(dragged.value.id) : null
    const ok = canDropOn(id)
    dragged.value = null
    dropOn.value = null
    if (person && ok) emit('move', person, id, from)
  },
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dl-muted">
      <span>{{ t('users.hierarchy.summary', { people: n(visible.size) }) }}</span>
      <span v-if="canDrag">{{ t('users.hierarchy.dragHint') }}</span>
      <span class="ms-auto flex gap-3">
        <button type="button" class="font-semibold hover:text-dl-fg" @click="expandAll">{{ t('users.hierarchy.expandAll') }}</button>
        <button type="button" class="font-semibold hover:text-dl-fg" @click="expanded = new Set()">{{ t('users.hierarchy.collapseAll') }}</button>
      </span>
    </div>

    <div v-if="!people.loaded.value" class="flex flex-col gap-1.5" aria-hidden="true">
      <DlSkeleton v-for="i in 6" :key="i" class="h-[54px] rounded-2xl" />
    </div>
    <p v-else-if="!roots.length && !alone.length" class="py-8 text-center text-sm text-dl-muted">{{ t('geo.empty.search') }}</p>
    <template v-else>
      <ul role="tree" :aria-label="t('users.hierarchy.title')" class="flex flex-col gap-1.5">
        <HierarchyNode v-for="id in roots" :key="id" :id="id" />
      </ul>
      <template v-if="alone.length">
        <h3 class="px-1 pt-3 text-xs font-bold uppercase tracking-[0.05em] text-dl-muted">{{ t('users.hierarchy.aloneGroup', { count: n(alone.length) }) }}</h3>
        <ul role="tree" :aria-label="t('users.hierarchy.aloneGroup', { count: n(alone.length) })" class="flex flex-col gap-1.5">
          <HierarchyNode v-for="id in alone" :key="id" :id="id" />
        </ul>
      </template>
    </template>
  </div>
</template>

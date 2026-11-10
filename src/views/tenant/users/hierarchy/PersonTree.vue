<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DlSkeleton from '@/components/DlSkeleton.vue'
import HierarchyNode from './HierarchyNode.vue'
import { HIERARCHY } from './hierarchyContext'
import { peopleAbove, peopleUnder } from './orgTree'
import { useOrgTree } from './useOrgTree'

// The hierarchy tree, cut down to one person: the people above them (every way up), the person
// (highlighted), and everyone under them. Same boxes as Users › Hierarchy; a click opens that
// person's page.
const props = defineProps<{ userId: number }>()
const router = useRouter()
const { people, tree } = useOrgTree()

const above = computed(() => peopleAbove(tree.value, props.userId))
const under = computed(() => peopleUnder(tree.value, props.userId))
const visible = computed(() => new Set([...above.value, props.userId, ...under.value]))
const roots = computed(() => [...tree.value.roots, ...tree.value.alone].filter(id => visible.value.has(id)))

// Open: the way down to the person, the person, and the level under them.
const expanded = ref(new Set<number>())
watch([() => props.userId, () => people.loaded.value], () => {
  expanded.value = new Set([...above.value, props.userId, ...(tree.value.childrenOf.get(props.userId) ?? [])])
}, { immediate: true })

provide(HIERARCHY, {
  tree,
  visible,
  hits: computed(() => new Set<number>()),
  expanded,
  showAll: ref(new Set<number>()),
  pageSize: 30,
  selectedId: computed(() => props.userId),
  canDrag: computed(() => false),
  dragged: ref(null),
  dropOn: ref(null),
  open: id => { if (id !== props.userId) router.push({ name: 'tenant-user-detail', params: { id } }) },
  toggle: id => {
    const next = new Set(expanded.value)
    if (!next.delete(id)) next.add(id)
    expanded.value = next
  },
  dragStart: () => {},
  dragEnd: () => {},
  dragOver: () => {},
  dragLeave: () => {},
  drop: () => {},
})
</script>

<template>
  <div v-if="!people.loaded.value" class="flex flex-col gap-1.5" aria-hidden="true">
    <DlSkeleton v-for="i in 3" :key="i" class="h-[54px] rounded-2xl" />
  </div>
  <ul v-else role="tree" class="flex flex-col gap-1.5">
    <HierarchyNode v-for="id in roots" :key="id" :id="id" />
  </ul>
</template>

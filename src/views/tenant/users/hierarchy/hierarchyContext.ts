import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { OrgTree } from './orgTree'

/** Shared by every box of the hierarchy (provided by UserHierarchy). */
export interface HierarchyContext {
  tree: ComputedRef<OrgTree>
  /** People shown for the current filters (matches and their managers). */
  visible: ComputedRef<Set<number>>
  /** Search matches, outlined. */
  hits: ComputedRef<Set<number>>
  expanded: Ref<Set<number>>
  /** Branches showing all their people (otherwise the first `pageSize`). */
  showAll: Ref<Set<number>>
  pageSize: number
  selectedId: ComputedRef<number | null>
  canDrag: ComputedRef<boolean>
  /** The person being dragged, and the manager whose box it was dragged from. */
  dragged: Ref<{ id: number; from: number | null } | null>
  dropOn: Ref<number | null>
  open: (id: number) => void
  toggle: (id: number) => void
  dragStart: (id: number, from: number | null, event: DragEvent) => void
  dragEnd: () => void
  dragOver: (id: number, event: DragEvent) => void
  dragLeave: (id: number) => void
  drop: (id: number) => void
}

export const HIERARCHY: InjectionKey<HierarchyContext> = Symbol('hierarchy')

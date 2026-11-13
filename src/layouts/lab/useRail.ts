import { ref, watch } from 'vue'

const STORAGE_KEY = 'delorc.rail'

// Open by default; only a saved "closed" choice keeps it collapsed.
function readExpanded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

// Shared by every part of the layout. Remembered per browser.
const expanded = ref(readExpanded())

watch(expanded, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Storage blocked: the choice just lasts for this visit.
  }
})

/** Desktop/tablet rail: expanded = icons with labels, collapsed = narrow icon rail. */
export function useRail() {
  return {
    expanded,
    toggle: () => {
      expanded.value = !expanded.value
    },
  }
}

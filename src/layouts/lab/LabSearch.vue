<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, VisuallyHidden } from 'reka-ui'
import DlIcon from '@/components/DlIcon.vue'
import { useWorkspaces } from './useWorkspaces'

/** Ctrl K (⌘K on a Mac) or a click on the search box: jump to a lab page. Same box as on central, pages only. */
const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const router = useRouter()
const { visibleWorkspaces } = useWorkspaces()

const query = ref('')
const active = ref(0)
const input = ref<HTMLInputElement | null>(null)

interface Result { key: string; group: 'pages'; label: string; detail: string; icon: string; to: RouteLocationRaw }

const pages = computed<Result[]>(() => [
  ...visibleWorkspaces.value.flatMap((ws) =>
    ws.links.map((link) => ({ key: link.title, group: 'pages' as const, label: t(link.title), detail: t(ws.title), icon: link.icon, to: link.to })),
  ),
  { key: 'profile', group: 'pages', label: t('layout.topbar.myProfile'), detail: t('layout.topbar.you'), icon: 'tabler-user', to: { name: 'tenant-profile' } },
])

const plain = (text: string) => text.toLocaleLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

const results = computed<Result[]>(() => {
  const q = plain(query.value.trim())

  return pages.value.filter((page) => plain(page.label).includes(q))
})

watch(results, () => { active.value = 0 })

watch(open, async (isOpen) => {
  if (!isOpen) return
  query.value = ''
  await nextTick()
  input.value?.focus()
})

function onShortcut(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value = !open.value
  }
}
onMounted(() => window.addEventListener('keydown', onShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', onShortcut))

function go(result: Result | undefined): void {
  if (!result) return
  open.value = false
  router.push(result.to)
}

function onKeydown(event: KeyboardEvent): void {
  const count = results.value.length
  if (event.key === 'ArrowDown' && count) {
    event.preventDefault()
    active.value = (active.value + 1) % count
  } else if (event.key === 'ArrowUp' && count) {
    event.preventDefault()
    active.value = (active.value - 1 + count) % count
  } else if (event.key === 'Enter') {
    event.preventDefault()
    go(results.value[active.value])
  }
}

/** The group title is shown above the first result of each group. */
const startsGroup = (index: number) => results.value[index - 1]?.group !== results.value[index]?.group
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-1900 bg-dl-ink/40" />
      <DialogContent
        class="fixed inset-x-4 top-[12vh] z-2000 mx-auto flex max-h-[70vh] max-w-[620px] flex-col overflow-hidden rounded-3xl border border-dl-line bg-dl-paper text-dl-fg shadow-[0_24px_64px_-24px_rgba(15,31,28,0.45)] focus:outline-hidden"
      >
        <VisuallyHidden><DialogTitle>{{ t('layout.topbar.searchTitle') }}</DialogTitle></VisuallyHidden>
        <label class="flex h-14 items-center gap-3 border-b border-dl-line-soft px-5">
          <DlIcon icon="tabler-search" :size="20" class="text-dl-muted" />
          <span class="sr-only">{{ t('layout.topbar.searchTitle') }}</span>
          <input
            ref="input"
            v-model="query"
            type="search"
            role="combobox"
            aria-controls="dl-search-results"
            :aria-expanded="true"
            :aria-activedescendant="results[active] ? `dl-search-${active}` : undefined"
            :placeholder="t('layout.topbar.search')"
            class="h-full flex-1 border-0 bg-transparent text-[15px] outline-hidden placeholder:text-dl-muted"
            @keydown="onKeydown"
          >
          <kbd class="rounded-md border border-dl-line px-1.5 py-0.5 font-sans text-xs text-dl-muted">Esc</kbd>
        </label>
        <ul id="dl-search-results" role="listbox" class="min-h-0 flex-1 overflow-y-auto p-2">
          <template v-for="(result, index) in results" :key="result.key">
            <li v-if="startsGroup(index)" role="presentation" class="px-3 pb-1 pt-2.5 text-xs font-bold uppercase tracking-wide text-dl-muted">
              {{ t(`layout.topbar.${result.group}`) }}
            </li>
            <li
              :id="`dl-search-${index}`"
              role="option"
              :aria-selected="index === active"
              class="flex h-12 cursor-pointer items-center gap-3 rounded-xl px-3"
              :class="index === active ? 'bg-dl-line-soft' : ''"
              @mousemove="active = index"
              @click="go(result)"
            >
              <span class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-dl-ink text-dl-signal">
                <DlIcon :icon="result.icon" :size="16" />
              </span>
              <span class="flex-1 truncate text-sm font-semibold">{{ result.label }}</span>
              <span class="text-xs text-dl-muted">{{ result.detail }}</span>
            </li>
          </template>
          <li v-if="!results.length" class="px-3 py-10 text-center text-sm text-dl-muted">{{ t('layout.topbar.searchEmpty') }}</li>
        </ul>
        <p class="border-t border-dl-line-soft px-5 py-2.5 text-xs text-dl-muted">{{ t('layout.topbar.searchHelp') }}</p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

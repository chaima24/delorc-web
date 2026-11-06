<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DlIcon from './DlIcon.vue'
import DlSheet from './DlSheet.vue'

/**
 * A record next to its list. Desktop: a panel beside the list (the list stays usable).
 * Phone and tablet: a bottom sheet. Put it in a flex row after the list.
 */
const props = defineProps<{
  title: string
  description?: string
}>()

const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const desktopQuery = window.matchMedia('(min-width: 1024px)')
const isDesktop = ref(desktopQuery.matches)
const onResize = () => { isDesktop.value = desktopQuery.matches }

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value && isDesktop.value) open.value = false
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  desktopQuery.addEventListener('change', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  desktopQuery.removeEventListener('change', onResize)
})
</script>

<template>
  <aside
    v-if="isDesktop && open"
    :aria-label="props.title"
    class="dl-panel sticky top-24 flex max-h-[calc(100vh-7.5rem)] w-[440px] shrink-0 flex-col self-start overflow-hidden rounded-3xl bg-dl-paper"
  >
    <header class="flex items-start gap-3 border-b border-dl-line-soft px-6 py-5">
      <slot name="media" />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <h2 class="font-display text-[22px] font-extrabold leading-tight tracking-[-0.01em]">{{ title }}</h2>
        <p v-if="description" class="text-[13px] text-dl-muted">{{ description }}</p>
        <slot name="badges" />
      </div>
      <slot name="actions" />
      <button
        type="button"
        :aria-label="t('common.actions.close')"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-dl-line hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
        @click="open = false"
      >
        <DlIcon icon="tabler-x" :size="18" />
      </button>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="flex flex-wrap gap-2 border-t border-dl-line-soft px-6 py-4">
      <slot name="footer" />
    </footer>
  </aside>

  <DlSheet v-else-if="!isDesktop" v-model:open="open" side="bottom" :title="title" :description="description">
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <slot name="badges" />
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </DlSheet>
</template>

<style scoped>
.dl-panel {
  animation: dl-panel-in 0.18s ease-out;
}
@keyframes dl-panel-in {
  from { opacity: 0; transform: translateX(12px); }
}
:dir(rtl) .dl-panel {
  animation-name: dl-panel-in-rtl;
}
@keyframes dl-panel-in-rtl {
  from { opacity: 0; transform: translateX(-12px); }
}
@media (prefers-reduced-motion: reduce) {
  .dl-panel { animation: none; }
}
</style>

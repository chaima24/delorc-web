<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Adv } from '@/api/tenant/advs'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import { useAdvText } from './advDisplay'

// "Aperçu": the ADV on a dark stage over the page, as the rep will see it in a visit. Read only, nothing is recorded.
// A gallery moves with the arrows, the keyboard or the thumbnails; a PDF opens in the browser's reader; a video plays;
// an HTML5 module is only stored (the phone app plays it), so it offers the download. Mockup: engage-mockups/Advs.html (frame 7)
const props = defineProps<{ adv: Adv }>()
const emit = defineEmits<{ close: [] }>()
const { t, n } = useI18n()
const text = useAdvText()

const slides = computed(() => props.adv.slides ?? [])
const index = ref(0)
const current = computed(() => slides.value[index.value] ?? null)
const gallery = computed(() => props.adv.type === 'galerie')
const move = (by: number) => { index.value = Math.min(slides.value.length - 1, Math.max(0, index.value + by)) }

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
  if (!gallery.value) return
  // Arrows follow the reading direction.
  const forward = document.documentElement.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') move(event.key === forward ? 1 : -1)
}
const closeButton = ref<HTMLButtonElement | null>(null)
onMounted(() => {
  window.addEventListener('keydown', onKey)
  closeButton.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div role="dialog" aria-modal="true" :aria-label="t('advs.preview.title', { name: adv.name })" class="fixed inset-0 z-1000 flex flex-col bg-dl-ink text-dl-on-ink">
      <header class="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4">
        <div class="flex min-w-0 flex-1 flex-col">
          <strong class="truncate text-base">{{ adv.name }}</strong>
          <small class="truncate text-[13px] text-dl-on-ink-muted">{{ [adv.brand?.name, text.type(adv.type), t(`advs.orientation.${adv.orientation}`)].filter(Boolean).join(' · ') }}</small>
        </div>
        <span class="rounded-full bg-dl-signal/15 px-2.5 py-1 text-xs font-bold text-dl-signal">{{ t('advs.preview.badge') }}</span>
        <button ref="closeButton" type="button" :aria-label="t('common.actions.close')" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dl-on-ink/20 hover:bg-dl-on-ink/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-signal" @click="emit('close')">
          <DlIcon icon="tabler-x" :size="18" />
        </button>
      </header>

      <div class="flex min-h-0 flex-1 items-center justify-center gap-3 px-4 pb-3 md:gap-6 md:px-6">
        <p v-if="!current?.url" class="text-sm text-dl-on-ink-muted">{{ t('advs.preview.empty') }}</p>

        <template v-else-if="gallery">
          <button type="button" :disabled="index === 0" :aria-label="t('advs.preview.previous')" class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-dl-on-ink/10 disabled:opacity-30 rtl:-scale-x-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-signal" @click="move(-1)">
            <DlIcon icon="tabler-chevron-left" :size="22" />
          </button>
          <img :src="current.url" :alt="t('advs.preview.imageOf', { n: n(index + 1), total: n(slides.length) })" class="max-h-full min-w-0 max-w-full rounded-2xl object-contain">
          <button type="button" :disabled="index === slides.length - 1" :aria-label="t('advs.preview.next')" class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-dl-on-ink/10 disabled:opacity-30 rtl:-scale-x-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-signal" @click="move(1)">
            <DlIcon icon="tabler-chevron-right" :size="22" />
          </button>
        </template>

        <iframe v-else-if="adv.type === 'pdf'" :src="current.url" :title="adv.name" class="h-full w-full max-w-5xl rounded-2xl bg-dl-paper" />
        <video v-else-if="adv.type === 'video'" :src="current.url" controls class="max-h-full max-w-full rounded-2xl" />
        <div v-else class="flex max-w-md flex-col items-center gap-4 text-center">
          <DlIcon icon="tabler-device-mobile" :size="40" />
          <p class="text-sm text-dl-on-ink-muted">{{ t('advs.preview.html5') }}</p>
          <DlButton variant="primary" icon="tabler-download" :href="current.url">{{ t('advs.preview.download', { size: text.size(current.size) }) }}</DlButton>
        </div>
      </div>

      <footer v-if="gallery && slides.length" class="flex flex-col items-center gap-2 px-4 pb-4">
        <div class="flex max-w-full gap-2 overflow-x-auto p-1">
          <button
            v-for="(slide, i) in slides"
            :key="slide.id"
            type="button"
            :aria-label="t('advs.preview.imageOf', { n: n(i + 1), total: n(slides.length) })"
            :aria-current="i === index"
            class="flex h-14 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-bold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-signal"
            :class="i === index ? 'bg-dl-signal text-dl-ink' : 'bg-dl-on-ink/10 text-dl-on-ink-muted'"
            @click="index = i"
          >{{ n(i + 1) }}</button>
        </div>
        <p class="text-[13px] text-dl-on-ink-muted max-md:hidden">{{ t('advs.preview.keys') }}</p>
      </footer>
    </div>
  </Teleport>
</template>

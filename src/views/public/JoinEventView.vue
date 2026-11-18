<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { joinEvent, type JoinView } from '@/api/tenant/events'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlLogo from '@/components/DlLogo.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { currentLocale, setLocale } from '@/plugins/i18n'
import { useLabStore } from '@/stores/lab'

// Public page (no login) opened from an event's online link email (docs/api/event-online-link.md, mockup frame 4). The
// page itself asks the API (a POST), so mail scanners that open links by themselves never tick « présent ». Inside the
// window it ticks the professional present and opens the meeting; too early or after the end it only says so.
const props = defineProps<{ token: string }>()
const { t, d } = useI18n()
const labStore = useLabStore()
const languages = computed(() => labStore.lab?.languages ?? [])
const locale = ref(currentLocale())
async function useLanguage(code: string) {
  await setLocale(code).catch(() => undefined)
  locale.value = currentLocale()
}

const view = ref<JoinView | null>(null)
const notFound = ref(false)
onMounted(async () => {
  try {
    view.value = await joinEvent(props.token)
    if (view.value.state === 'open' && view.value.url) window.location.assign(view.value.url)
  }
  catch {
    notFound.value = true
  }
})
const day = (value: string) => d(new Date(value), { weekday: 'long', day: 'numeric', month: 'long' })
const time = (value: string) => d(new Date(value), { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex min-h-dvh justify-center bg-dl-mist px-4 py-6 text-dl-fg">
    <main class="flex w-full max-w-md flex-col self-start overflow-hidden rounded-[28px] bg-dl-paper">
      <header class="flex items-center gap-3 bg-dl-ink px-5 py-4 text-dl-on-ink">
        <DlLogo :size="30" on-dark />
        <strong class="flex-1 truncate">{{ view?.lab ?? '' }}</strong>
        <nav v-if="languages.length > 1" class="flex gap-1 text-xs" :aria-label="t('consents.page.language')">
          <button
            v-for="language in languages"
            :key="language.code"
            type="button"
            class="rounded-md px-1.5 py-0.5"
            :class="locale === language.code ? 'bg-dl-signal font-bold text-dl-ink' : 'text-dl-on-ink-muted hover:text-dl-on-ink'"
            @click="useLanguage(language.code)"
          >
            {{ language.code === 'ar' ? 'ع' : language.code.toUpperCase() }}
          </button>
        </nav>
      </header>

      <div class="flex flex-col items-center gap-4 p-6 text-center">
        <DlSkeleton v-if="!view && !notFound" class="h-40 w-full rounded-2xl" />
        <template v-else-if="notFound">
          <DlIcon icon="tabler-link-off" :size="40" class="text-dl-muted" />
          <h1 class="font-display text-[22px] font-extrabold">{{ t('join.notFoundTitle') }}</h1>
          <p class="text-[15px] text-dl-body">{{ t('join.notFoundText') }}</p>
        </template>
        <template v-else-if="view?.state === 'open'">
          <DlIcon icon="tabler-circle-check" :size="44" class="text-dl-teal" />
          <h1 class="font-display text-[24px] font-extrabold">{{ t('join.openTitle', { name: view.name }) }}</h1>
          <p class="text-[15px] text-dl-body">{{ t('join.openText', { event: view.event.name }) }}</p>
          <DlButton variant="primary" block :href="view.url ?? undefined">{{ t('join.openButton') }}</DlButton>
          <p class="text-[13px] text-dl-muted">{{ t('join.openHint') }}</p>
        </template>
        <template v-else-if="view?.state === 'early'">
          <DlIcon icon="tabler-clock" :size="44" class="text-dl-muted" />
          <h1 class="font-display text-[24px] font-extrabold">{{ t('join.earlyTitle') }}</h1>
          <p class="text-[15px] text-dl-body">{{ t('join.earlyText', { event: view.event.name, day: day(view.event.start_at), time: time(view.event.start_at), opens: time(view.opens_at) }) }}</p>
        </template>
        <template v-else-if="view">
          <DlIcon icon="tabler-square" :size="44" class="text-dl-muted" />
          <h1 class="font-display text-[24px] font-extrabold">{{ t('join.endedTitle') }}</h1>
          <p class="text-[15px] text-dl-body">{{ t('join.endedText', { event: view.event.name, day: day(view.event.end_at), time: time(view.event.end_at) }) }}</p>
        </template>
      </div>
    </main>
  </div>
</template>

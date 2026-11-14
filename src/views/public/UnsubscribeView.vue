<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { confirmUnsubscribe, fetchUnsubscribe, type UnsubscribeView } from '@/api/tenant/campaignSendings'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlLogo from '@/components/DlLogo.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { currentLocale, setLocale } from '@/plugins/i18n'
import { useLabStore } from '@/stores/lab'

// Public page (no login) opened from the unsubscribe link of a campaign email (docs/api/campaign-sendings.md). One
// confirming click (mail scanners open links by themselves), then « C'est noté ». The consent stays given; a new
// consent they answer brings them back. Mockup: docs/design/campaigns-mockups/Sendings.html (frames 7 and 7a)
const props = defineProps<{ token: string }>()
const { t } = useI18n()
const labStore = useLabStore()
const languages = computed(() => labStore.lab?.languages ?? [])
const locale = ref(currentLocale())
async function useLanguage(code: string) {
  await setLocale(code).catch(() => undefined)
  locale.value = currentLocale()
}

const view = ref<UnsubscribeView | null>(null)
const notFound = ref(false)
const saving = ref(false)
onMounted(async () => {
  try {
    view.value = await fetchUnsubscribe(props.token)
  }
  catch {
    notFound.value = true
  }
})
async function confirm() {
  saving.value = true
  try {
    view.value = await confirmUnsubscribe(props.token)
  }
  finally {
    saving.value = false
  }
}
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
          <h1 class="font-display text-[22px] font-extrabold">{{ t('consents.page.notFoundTitle') }}</h1>
        </template>
        <template v-else-if="view?.done">
          <DlIcon icon="tabler-circle-check" :size="44" class="text-dl-teal" />
          <h1 class="font-display text-[24px] font-extrabold">{{ t('unsubscribe.doneTitle') }}</h1>
          <p class="text-[15px] text-dl-body">{{ t('unsubscribe.doneText', { lab: view.lab, email: view.email }) }}</p>
          <p class="text-[13px] text-dl-muted">{{ t('unsubscribe.back') }}</p>
        </template>
        <template v-else-if="view">
          <DlIcon icon="tabler-mail-off" :size="44" class="text-dl-muted" />
          <h1 class="font-display text-[24px] font-extrabold">{{ t('unsubscribe.title') }}</h1>
          <p class="text-[15px] text-dl-body">{{ t('unsubscribe.text', { lab: view.lab, email: view.email }) }}</p>
          <DlButton variant="dark" block :loading="saving" @click="confirm">{{ t('unsubscribe.confirm') }}</DlButton>
          <p class="text-[13px] text-dl-muted">{{ t('unsubscribe.hint') }}</p>
        </template>
      </div>
    </main>
  </div>
</template>

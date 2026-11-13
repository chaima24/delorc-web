<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchLanguages, type Language } from '@/api/tenant/fieldSetup'
import DlBadge from '@/components/DlBadge.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { rulesSection } from '@/views/tenant/settings/shared/studioSections'

// Languages are switched on by Delorc (central): the lab sees which ones, and how many people use each.
// Mockup: docs/design/studio-mockups/RulesPlatform.html
const { t, n } = useI18n()

const languages = ref<Language[]>([])
const loading = ref(true)
const failed = ref(false)

onMounted(async () => {
  try {
    const response = await fetchLanguages({ per_page: 100, sort: 'code' })
    languages.value = response.items
      .sort((a, b) => Number(b.is_active) - Number(a.is_active) || (b.users_count ?? 0) - (a.users_count ?? 0))
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <StudioListPage :section="rulesSection" :title="t('rulesSetup.title.languages')">
    <ul v-if="loading" class="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      <li v-for="i in 3" :key="i"><DlSkeleton class="h-44 rounded-[22px]" /></li>
    </ul>
    <p v-else-if="failed" class="text-sm text-dl-rejected">{{ t('studio.list.toast.failed') }}</p>
    <ul v-else class="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      <li
        v-for="language in languages"
        :key="language.id"
        class="flex flex-col gap-3.5 rounded-[22px] bg-dl-mist p-5"
      >
        <div class="flex items-start justify-between gap-3">
          <span
            class="flex h-12 w-12 items-center justify-center rounded-[14px] font-display text-[17px] font-extrabold uppercase"
            :class="language.is_active ? 'bg-dl-ink text-dl-signal' : 'bg-dl-line-soft text-dl-muted'"
            aria-hidden="true"
          >{{ language.code }}</span>
          <DlBadge size="sm" :tone="language.is_active ? 'success' : 'neutral'" dot>
            {{ t(language.is_active ? 'rulesSetup.status.active' : 'rulesSetup.languages.off') }}
          </DlBadge>
        </div>
        <div>
          <h2 class="font-display text-[22px] font-extrabold tracking-[-0.01em]">{{ language.name }}</h2>
          <p :lang="language.code" :dir="language.direction" class="text-[15px] text-dl-body">{{ language.native_name || language.name }}</p>
        </div>
        <div class="flex justify-between gap-3 border-t border-dl-line pt-3 text-[13px] text-dl-muted">
          <span>{{ t(language.direction === 'rtl' ? 'rulesSetup.languages.rtl' : 'rulesSetup.languages.ltr') }}</span>
          <span>{{ t('rulesSetup.languages.people', { count: n(language.users_count ?? 0) }, language.users_count ?? 0) }}</span>
        </div>
      </li>
    </ul>

    <p class="flex items-start gap-2.5 rounded-2xl bg-dl-mist px-4 py-3 text-[13px] text-dl-body">
      <DlIcon icon="tabler-info-circle" :size="18" class="shrink-0 text-dl-muted" />
      {{ t('rulesSetup.languages.note') }}
    </p>
  </StudioListPage>
</template>

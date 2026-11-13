<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { studioApi, type StudioCounts } from '@/api/tenant/studio'
import DlButton from '@/components/DlButton.vue'
import DlCard from '@/components/DlCard.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlProgress from '@/components/DlProgress.vue'
import { useAuthStore } from '@/stores/auth'
import { settingsGroups, type SettingsLink } from './settingsGroups'
import { studioSetupSteps } from './studioSetup'

// Studio › Settings. Mockup: docs/design/studio-mockups/Studio.html
const { t, n } = useI18n()
const auth = useAuthStore()

// The cards this person may open; a group with none is not shown.
const visibleSettingsGroups = computed(() => settingsGroups
  .map(group => ({ ...group, links: group.links.filter(link => (!link.resource || auth.can(`${link.resource}.show`)) && (!link.feature || auth.hasFeature(link.feature))) }))
  .filter(group => group.links.length > 0))
const visibleSettingsLinks = computed(() => visibleSettingsGroups.value.flatMap(group => group.links))

const search = ref('') // filters the cards
const counts = ref<StudioCounts | null>(null)

onMounted(async () => {
  try {
    counts.value = await studioApi.summary()
  }
  catch {
    // Counts are a help, not a requirement: the page works without them.
  }
})

/** The groups whose cards match the search, by title or description. */
const filteredGroups = computed(() => {
  const words = search.value.trim().toLocaleLowerCase()
  const matches = (link: SettingsLink) => `${t(link.title)} ${link.description ? t(link.description) : ''}`.toLocaleLowerCase().includes(words)

  return words ? visibleSettingsGroups.value.map(group => ({ ...group, links: group.links.filter(matches) })).filter(group => group.links.length) : visibleSettingsGroups.value
})

const setup = computed(() => {
  if (!counts.value) return null
  const c = counts.value
  const steps = studioSetupSteps.map(step => ({ ...step, isDone: step.done(c) }))
  const doneCount = steps.filter(step => step.isDone).length

  return { steps, doneCount, next: steps.find(step => !step.isDone) }
})

function countOf(key?: string) {
  if (!key || !counts.value || counts.value[key] == null) return null
  return counts.value[key]
}
</script>

<template>
  <div class="flex w-full flex-col gap-7">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.studio') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">
          {{ t('settings.hub.title') }}
        </h1>
      </div>
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('settings.hub.searchPlaceholder')"
        shortcut="/"
        :placeholder="t('settings.hub.searchPlaceholder')"
        hide-label
        class="w-full sm:w-80"
      />
    </div>

    <!-- Lab setup: hidden once every step is done -->
    <section
      v-if="setup && setup.next"
      :aria-label="t('studio.setup.title')"
      class="flex flex-wrap items-center gap-6 rounded-3xl bg-dl-paper p-5 md:px-6"
    >
      <div class="flex min-w-[200px] flex-col gap-1.5">
        <span class="text-[13px] text-dl-muted">{{ t('studio.setup.title') }}</span>
        <span class="font-display text-4xl font-extrabold leading-none tracking-[-0.02em]">
          {{ setup.doneCount }}<span class="ms-1.5 font-sans text-lg font-semibold text-dl-muted">{{ t('studio.setup.of', { total: setup.steps.length }) }}</span>
        </span>
        <DlProgress :value="(setup.doneCount / setup.steps.length) * 100" :label="t('studio.setup.title')" tone="signal" class="max-w-[200px]" />
      </div>

      <ol class="hidden flex-1 flex-wrap gap-2 md:flex">
        <li v-for="step in setup.steps" :key="step.key">
          <RouterLink
            :to="step.to"
            class="flex h-9 items-center gap-2 rounded-[10px] px-3 text-[13px] font-semibold no-underline transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
            :class="step.isDone
              ? 'bg-dl-signal-soft text-dl-fg'
              : step === setup.next
                ? 'bg-dl-ink text-dl-on-ink dark:bg-dl-fg dark:text-dl-mist'
                : 'bg-dl-mist text-dl-muted hover:text-dl-fg'"
          >
            <DlIcon v-if="step.isDone" icon="tabler-check" :size="16" />
            <DlIcon v-else-if="step === setup.next" icon="tabler-arrow-right" :size="16" class="rtl:-scale-x-100" />
            <span class="sr-only">{{ step.isDone ? t('studio.setup.done') : t('studio.setup.todo') }}:</span>
            {{ step === setup.next ? t(`studio.setup.next.${step.key}`) : t(`studio.setup.steps.${step.key}`) }}
          </RouterLink>
        </li>
      </ol>

      <DlButton :to="setup.next.to" variant="dark" icon-end="tabler-arrow-right" block class="md:hidden">
        {{ t(`studio.setup.next.${setup.next.key}`) }}
      </DlButton>
    </section>

    <DlCard v-if="!visibleSettingsLinks.length">
      <DlEmptyState icon="tabler-lock" :title="t('settings.hub.noAccess')" :description="t('settings.hub.noAccessDetail')" />
    </DlCard>

    <DlCard v-else-if="!filteredGroups.length">
      <DlEmptyState icon="tabler-search-off" :title="t('settings.hub.noResults', { term: search })" :description="t('settings.hub.noResultsHint')">
        <DlButton variant="outline" size="sm" @click="search = ''">
          {{ t('settings.hub.clearSearch') }}
        </DlButton>
      </DlEmptyState>
    </DlCard>

    <template v-else>
      <section v-for="group in filteredGroups" :key="group.title" class="flex flex-col gap-3" :aria-label="t(group.title)">
        <div>
          <h2 class="font-display text-xl font-extrabold tracking-[-0.01em]">{{ t(group.title) }}</h2>
          <p class="text-[13px] text-dl-muted">{{ t(group.subtitle) }}</p>
        </div>
        <ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <li v-for="link in group.links" :key="link.title">
            <RouterLink
              :to="link.to"
              class="group flex h-full items-center gap-3.5 rounded-[20px] border border-transparent bg-dl-paper p-4 text-dl-fg no-underline transition hover:border-dl-line focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
            >
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-dl-line-soft transition group-hover:bg-dl-ink group-hover:text-dl-signal">
                <DlIcon :icon="link.icon" :size="22" />
              </span>
              <span class="flex min-w-0 flex-col gap-0.5">
                <span class="text-[15px] font-bold">{{ t(link.title) }}</span>
                <span v-if="link.description" class="text-xs text-dl-muted">{{ t(link.description) }}</span>
              </span>
              <span
                v-if="countOf(link.count) !== null"
                class="ms-auto shrink-0 text-[13px] font-semibold tabular-nums"
                :class="countOf(link.count) === 0 ? 'text-dl-pending' : 'text-dl-body'"
              >
                {{ countOf(link.count) === 0 ? t('settings.hub.noneYet') : n(countOf(link.count)!) }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

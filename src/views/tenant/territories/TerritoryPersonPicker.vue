<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DlCombobox from '@/components/DlCombobox.vue'
import { useUsers } from './useTerritoryLookups'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import type { usePeopleSuggestions } from './usePeopleSuggestions'

// Pick a person to work a territory: suggested people first (home commune in its places, team
// fits), "Show all" for everyone. Mockup: docs/design/customers-mockups/Territories.html (frame 5)
const props = defineProps<{
  suggestions: ReturnType<typeof usePeopleSuggestions>
  /** Already picked or working it. */
  exclude: number[]
  label: string
  error?: string
}>()
const chosen = defineModel<number | null>({ default: null })
const { t, n } = useI18n()
const users = useUsers()
users.ensureLoaded()

const showAll = ref(false)
const free = computed(() => users.items.value.filter(user => !props.exclude.includes(user.id)))
const suggested = computed(() => free.value.filter(user => props.suggestions.isSuggested(user.id)))
const noHome = computed(() => free.value.filter(user => props.suggestions.byId.value.get(user.id)?.no_home).length)
const options = computed(() => (showAll.value ? free.value : suggested.value)
  .map(user => ({
    value: user.id,
    label: user.full_name,
    hint: [user.role ? roleLabel(user.role) : '', props.suggestions.where(user.id)].filter(Boolean).join(' · ') || undefined,
  }))
  .sort((a, b) => a.label.localeCompare(b.label)))
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex flex-wrap items-center gap-2">
      <span class="min-w-0 flex-1 text-[12.5px] text-dl-muted">{{ showAll ? t('territories.people.allWhy') : t('territories.people.suggestedWhy') }}</span>
      <span class="inline-flex gap-0.5 rounded-[9px] bg-dl-mist p-0.5" role="group" :aria-label="label">
        <button
          v-for="all in [false, true]"
          :key="String(all)"
          type="button"
          :aria-pressed="showAll === all"
          class="h-7 rounded-[7px] px-2.5 text-[11.5px] font-semibold tabular-nums transition"
          :class="showAll === all ? 'bg-dl-paper text-dl-fg shadow-xs' : 'text-dl-body hover:text-dl-fg'"
          @click="showAll = all"
        >
          {{ all ? t('territories.people.showAll', { n: n(free.length) }) : t('territories.people.suggested', { n: n(suggested.length) }) }}
        </button>
      </span>
    </div>
    <DlCombobox v-model="chosen" :label="label" :options="options" :error="error" :placeholder="!showAll && !suggested.length ? t('territories.people.noSuggestion') : undefined" />
    <p v-if="!showAll && noHome" class="text-[12.5px] text-dl-muted">
      {{ t('territories.people.noHomeCount', { n: n(noHome) }, noHome) }}
      <button type="button" class="font-semibold text-dl-cobalt" @click="showAll = true">{{ t('territories.people.showAllLink') }}</button>
    </p>
  </div>
</template>

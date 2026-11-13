<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RuleCoverage } from '@/api/tenant/rules'

/** "45 of 49 people follow a planning rule", with the people who don't one click away. */
const props = defineProps<{
  coverage: RuleCoverage
  /** i18n keys: the sentence, and what having no rule means. */
  textKey: string
  noRuleKey: string
}>()

const { t, n } = useI18n()
const showing = ref(false)
const missing = computed(() => props.coverage.people - props.coverage.covered)
const percent = computed(() => (props.coverage.people ? Math.round((props.coverage.covered / props.coverage.people) * 100) : 0))
</script>

<template>
  <section class="flex flex-col gap-2.5 rounded-2xl bg-dl-mist px-4 py-3" :aria-label="t('rulesSetup.coverage.label')">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px]">
      <span
        class="relative h-2 w-44 shrink-0 overflow-hidden rounded-full bg-dl-paper"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <i class="absolute inset-y-0 start-0 rounded-full bg-dl-cobalt" :style="{ width: `${percent}%` }" />
      </span>
      <span>
        <strong>{{ t('rulesSetup.coverage.count', { covered: n(coverage.covered), people: n(coverage.people) }) }}</strong>
        {{ t(textKey) }}
      </span>
      <span v-if="missing" class="text-xs text-dl-muted">{{ t(noRuleKey, missing) }}</span>
      <button
        v-if="missing"
        type="button"
        class="ms-auto whitespace-nowrap text-[13px] font-semibold text-dl-cobalt hover:underline"
        :aria-expanded="showing"
        @click="showing = !showing"
      >
        {{ showing ? t('rulesSetup.coverage.hide') : t('rulesSetup.coverage.show') }}
      </button>
    </div>
    <ul v-if="showing" class="flex flex-wrap gap-1.5">
      <li v-for="user in coverage.uncovered" :key="user.id" class="rounded-full bg-dl-paper px-2.5 py-1 text-xs font-semibold text-dl-body">
        {{ user.full_name }}
      </li>
      <li v-if="missing > coverage.uncovered.length" class="px-1 py-1 text-xs text-dl-muted">
        {{ t('rulesSetup.coverage.more', missing - coverage.uncovered.length) }}
      </li>
    </ul>
  </section>
</template>

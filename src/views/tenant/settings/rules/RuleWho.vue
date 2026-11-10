<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RuleWho } from '@/api/tenant/rules'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

/** Reading mode of "Who": the roles and teams (or "chosen people"), and the people following it. */
const props = defineProps<{ rule: RuleWho & { id: number } }>()

const { t, n } = useI18n()
const showing = ref(false)
watch(() => props.rule.id, () => { showing.value = false })
</script>

<template>
  <div class="flex flex-col gap-2">
    <ul v-if="rule.roles?.length || rule.teams?.length" class="flex flex-wrap gap-1.5">
      <li v-for="role in rule.roles" :key="`r${role.id}`" class="rounded-full bg-dl-line-soft px-2.5 py-1 text-xs font-semibold">{{ roleLabel(role.name) }}</li>
      <li v-if="!rule.roles?.length" class="rounded-full bg-dl-line-soft px-2.5 py-1 text-xs font-semibold">{{ t('fieldSetup.filter.allRoles') }}</li>
      <li v-for="team in rule.teams" :key="`t${team.id}`" class="rounded-full bg-dl-line-soft px-2.5 py-1 text-xs font-semibold">{{ team.name }}</li>
      <li v-if="!rule.teams?.length" class="rounded-full bg-dl-line-soft px-2.5 py-1 text-xs font-semibold">{{ t('fieldSetup.filter.allTeams') }}</li>
    </ul>
    <p>
      {{ t('rulesSetup.who.following', { count: n(rule.users_count ?? 0) }, rule.users_count ?? 0) }}
      <template v-if="rule.users?.length">
        ·
        <button type="button" class="font-semibold text-dl-cobalt hover:underline" :aria-expanded="showing" @click="showing = !showing">
          {{ showing ? t('rulesSetup.coverage.hide') : t('rulesSetup.who.seeThem') }}
        </button>
      </template>
    </p>
    <ul v-if="showing" class="flex flex-wrap gap-1.5">
      <li v-for="user in rule.users" :key="user.id" class="rounded-full border border-dl-line px-2.5 py-1 text-xs">{{ user.full_name }}</li>
    </ul>
  </div>
</template>

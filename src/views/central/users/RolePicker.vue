<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import type { Role } from '@/api/central/roles'
import { useAccessLabels } from '@/composables/useAccessLabels'

/** One role per person, so radio buttons. */
defineProps<{ roles: Role[]; error?: string }>()
const model = defineModel<string | null>()

const { t } = useI18n()
const { roleLabel } = useAccessLabels()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <span class="text-[13px] font-semibold">{{ t('central.users.role') }}</span>
    <RadioGroupRoot v-model="model" class="flex flex-col gap-1.5">
      <RadioGroupItem
        v-for="role in roles"
        :key="role.id"
        :value="role.name"
        class="flex items-start gap-2.5 rounded-xl border border-dl-line p-3 text-start text-[13px] data-[state=checked]:border-dl-ink data-[state=checked]:bg-dl-signal-soft data-[state=checked]:shadow-[inset_0_0_0_1px_rgb(var(--dl-ink))]"
      >
        <span class="mt-px h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-dl-muted" :class="model === role.name && 'border-[5px] border-dl-ink'" />
        <span>
          <b class="block text-[13.5px]">{{ roleLabel(role.name) }}</b>
          <small class="text-xs text-dl-muted">{{ role.is_super ? t('access.everything') : t('access.actionsCount', { count: role.permissions.length }) }}</small>
        </span>
      </RadioGroupItem>
    </RadioGroupRoot>
    <p v-if="error" class="text-xs text-dl-rejected">{{ error }}</p>
  </div>
</template>

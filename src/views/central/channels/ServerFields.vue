<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MailServerFields } from '@/api/central/channels'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'

/** The SMTP fields shared by Delorc's account and a lab's own account. */
defineProps<{ errors: Record<string, string>; passwordSaved: boolean }>()
const form = defineModel<MailServerFields>({ required: true })

const { t } = useI18n()
const encryptions = computed(() => (['tls', 'ssl', 'none'] as const).map((value) => ({ value, label: t(`central.channels.encryption.${value}`) })))
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
    <DlInput v-model="form.host" :label="t('central.channels.host')" :error="errors.host" />
    <DlInput v-model.number="form.port" type="number" min="1" max="65535" :label="t('central.channels.port')" :error="errors.port" />
    <DlSelect v-model="form.encryption" :label="t('central.channels.encryptionLabel')" :options="encryptions" />
  </div>
  <div class="grid gap-3 sm:grid-cols-2">
    <DlInput v-model="form.username" :label="t('central.channels.username')" :error="errors.username" autocomplete="off" />
    <DlInput
      v-model="form.password"
      type="password"
      :label="t('central.channels.password')"
      :placeholder="passwordSaved ? '••••••••' : ''"
      :hint="passwordSaved ? t('central.channels.passwordKeep') : t('central.channels.passwordNew')"
      :error="errors.password"
      autocomplete="new-password"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DlButton from '@/components/DlButton.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'

/** "Delete", asked twice. Disabled with a reason while something is underneath. */
const props = defineProps<{ hint: string; blocked: boolean; busy: boolean; resetKey: unknown }>()
const emit = defineEmits<{ confirm: [] }>()

const { t } = useI18n()
const confirming = ref(false)

watch(() => props.resetKey, () => { confirming.value = false })
</script>

<template>
  <DlRecordSection :title="t('common.actions.delete')" :can-edit="false">
    {{ hint }}
    <div class="mt-2 flex gap-2">
      <DlButton v-if="!confirming" variant="outline" size="sm" :disabled="blocked" @click="confirming = true">{{ t('common.actions.delete') }}</DlButton>
      <template v-else>
        <DlButton variant="danger" size="sm" :loading="busy" @click="emit('confirm')">{{ t('central.geography.deleteConfirm') }}</DlButton>
        <DlButton variant="ghost" size="sm" @click="confirming = false">{{ t('common.actions.cancel') }}</DlButton>
      </template>
    </div>
  </DlRecordSection>
</template>

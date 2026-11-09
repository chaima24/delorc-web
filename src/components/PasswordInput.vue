<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'

/** A password field with the eye button. Other attributes go to the field. */
defineProps<{ label: string }>()

const model = defineModel<string>()
const { t } = useI18n()
const visible = ref(false)
</script>

<template>
  <DlInput v-model="model" :label="label" large :type="visible ? 'text' : 'password'">
    <template #end>
      <button
        type="button"
        class="text-dl-muted hover:text-dl-fg"
        :aria-label="t(visible ? 'auth.password.hide' : 'auth.password.show')"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        <DlIcon :icon="visible ? 'tabler-eye-off' : 'tabler-eye'" :size="20" />
      </button>
    </template>
  </DlInput>
</template>

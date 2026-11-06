<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

/** On or off, with its label beside it. */
defineProps<{ label: string }>()

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label class="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-dl-fg">
    <SwitchRoot
      v-model="model"
      class="relative h-5 w-[34px] shrink-0 rounded-full bg-dl-line transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt data-[state=checked]:bg-dl-ink"
    >
      <SwitchThumb class="block h-3.5 w-3.5 translate-x-[3px] rounded-full bg-dl-paper transition data-[state=checked]:translate-x-[17px] data-[state=checked]:bg-dl-signal rtl:-translate-x-[3px] rtl:data-[state=checked]:-translate-x-[17px]" />
    </SwitchRoot>
    {{ label }}
  </label>
</template>

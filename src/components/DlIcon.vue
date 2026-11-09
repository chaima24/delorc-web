<script setup lang="ts">
import { Icon } from '@iconify/vue/offline'
import '@/plugins/icons'

/** Tabler icon by name, e.g. `tabler-home`. The offline build never calls the internet. */
withDefaults(defineProps<{
  icon: string
  size?: number | string
}>(), {
  size: 20,
})
</script>

<template>
  <Icon
    :icon="icon"
    :width="size"
    :height="size"
    class="shrink-0"
    aria-hidden="true"
  />
</template>

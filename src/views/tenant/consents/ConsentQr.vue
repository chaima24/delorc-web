<script setup lang="ts">
import QRCode from 'qrcode'
import { ref, watch } from 'vue'
import { tokenHex } from './tokenColor'

// The QR code of a consent link (drawn here, nothing sent anywhere). Exposes the image for "Download".
// Ink on light in both themes (these two tokens don't change in dark mode), so it always scans.
const props = defineProps<{ link: string; label: string }>()
const src = ref('')
watch(() => props.link, async link => {
  src.value = await QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: tokenHex('ink'), light: tokenHex('on-ink') } })
}, { immediate: true })
defineExpose({ src })
</script>

<template>
  <img v-if="src" :src="src" :alt="label" class="h-44 w-44 rounded-2xl border border-dl-line bg-dl-on-ink p-2">
</template>

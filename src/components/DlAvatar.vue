<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  tone?: 'cobalt' | 'neutral' | 'signal'
}>(), {
  size: 'md',
  tone: 'cobalt',
})

const initials = computed(() =>
  props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?',
)

// A photo that fails to load (e.g. an expired signed link) falls back to the initials.
const broken = ref(false)
watch(() => props.src, () => { broken.value = false })
const photo = computed(() => (props.src && !broken.value ? props.src : null))

const sizes = { sm: 'h-8 w-8 text-[11px] rounded-[10px]', md: 'h-11 w-11 text-sm rounded-xl', lg: 'h-14 w-14 text-base rounded-2xl', xl: 'h-[72px] w-[72px] text-[22px] rounded-[20px]' }
const tones = { cobalt: 'bg-dl-cobalt text-white', neutral: 'bg-dl-line-soft text-dl-fg', signal: 'bg-dl-signal text-[#0F1F1C]' }
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden font-bold"
    :class="[sizes[size], tones[tone]]"
  >
    <img v-if="photo" :src="photo" :alt="name" class="h-full w-full object-cover" @error="broken = true">
    <span v-else aria-hidden="true">{{ initials }}</span>
    <span v-if="!photo" class="sr-only">{{ name }}</span>
  </span>
</template>

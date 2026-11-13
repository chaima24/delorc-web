<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  subtitle?: string
  padding?: 'none' | 'md' | 'lg'
  tone?: 'paper' | 'ink'
}>(), {
  padding: 'md',
  tone: 'paper',
})
</script>

<template>
  <section
    :aria-label="title"
    class="flex min-w-0 flex-col gap-4 rounded-3xl"
    :class="[
      tone === 'ink' ? 'bg-dl-ink text-dl-on-ink' : 'bg-dl-paper text-dl-fg',
      padding === 'md' && 'p-5 md:p-6',
      padding === 'lg' && 'p-6 md:p-8',
    ]"
  >
    <header
      v-if="title || $slots.actions"
      class="flex flex-wrap items-baseline justify-between gap-2"
    >
      <div class="flex min-w-0 flex-col gap-0.5">
        <h2 v-if="title" class="font-display text-xl font-extrabold leading-tight tracking-[-0.01em]">
          {{ title }}
        </h2>
        <p
          v-if="subtitle"
          class="text-[13px]"
          :class="tone === 'ink' ? 'text-dl-on-ink-muted' : 'text-dl-muted'"
        >
          {{ subtitle }}
        </p>
      </div>
      <slot name="actions" />
    </header>
    <slot />
    <footer v-if="$slots.footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

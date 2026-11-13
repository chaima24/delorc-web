<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ColorAreaArea,
  ColorAreaRoot,
  ColorAreaThumb,
  ColorSliderRoot,
  ColorSliderThumb,
  ColorSliderTrack,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import DlInput from '@/components/DlInput.vue'

/**
 * Hex colour: type it, or pick it in a small popup (ready swatches, then a colour square + hue slider).
 * Our own popup (not the browser's picker) so it always stays inside the screen.
 */
defineProps<{
  label: string
  error?: string
  disabled?: boolean
}>()

const model = defineModel<string>({ required: true })
const open = ref(false)

// Stored values the lab picks from (data, not app styling).
const SWATCHES = [
  '#2F8F5B', '#7CB518', '#C8A200', '#E8A33D', '#E0662F', '#C0362C',
  '#C2185B', '#7B3FA0', '#2F54EB', '#1E88C8', '#13A89E', '#5F6B68',
]

/** The square and the slider need a valid colour while the field is empty or half typed. */
const hex = computed({
  get: () => (/^#[0-9a-f]{6}$/i.test(model.value) ? model.value : '#2F54EB'),
  set: (value: string) => { model.value = value.toUpperCase() },
})

function pick(color: string) {
  model.value = color
  open.value = false
}
</script>

<template>
  <DlInput v-model="model" :label="label" :error="error" :disabled="disabled" placeholder="#2F54EB" maxlength="7">
    <template #end>
      <PopoverRoot v-model:open="open">
        <PopoverTrigger
          type="button"
          :disabled="disabled"
          class="h-7 w-7 shrink-0 cursor-pointer rounded-lg border border-dl-line disabled:cursor-not-allowed"
          :style="{ background: model || 'transparent' }"
        >
          <span class="sr-only">{{ label }}</span>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            align="end"
            :side-offset="8"
            :collision-padding="16"
            class="z-2100 flex w-[244px] flex-col gap-3 rounded-2xl border border-dl-line bg-dl-paper p-3 shadow-[0_12px_32px_-12px_rgba(15,31,28,0.25)]"
          >
            <div class="grid grid-cols-6 gap-2">
              <button
                v-for="color in SWATCHES"
                :key="color"
                type="button"
                class="h-7 w-7 cursor-pointer rounded-lg border border-dl-line"
                :class="model?.toUpperCase() === color ? 'ring-2 ring-dl-cobalt ring-offset-2 ring-offset-dl-paper' : ''"
                :style="{ background: color }"
                :aria-label="color"
                @click="pick(color)"
              />
            </div>

            <ColorAreaRoot v-slot="{ style }" v-model="hex" color-space="hsb" x-channel="saturation" y-channel="brightness">
              <ColorAreaArea class="relative h-36 w-full cursor-crosshair rounded-xl" :style="style">
                <ColorAreaThumb class="h-4 w-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt" />
              </ColorAreaArea>
            </ColorAreaRoot>

            <ColorSliderRoot v-model="hex" channel="hue" color-space="hsb" class="relative flex h-4 w-full touch-none items-center select-none">
              <ColorSliderTrack class="relative h-3 w-full grow rounded-full" />
              <ColorSliderThumb class="block h-4 w-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt" />
            </ColorSliderRoot>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
    </template>
  </DlInput>
</template>

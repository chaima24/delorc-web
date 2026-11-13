import { watch, type WatchSource } from 'vue'

/** Runs `run` once the source has not changed for `wait` ms (and once at the start). */
export function watchDebounced<T>(source: WatchSource<T>, run: () => void, wait = 300): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(source, () => {
    clearTimeout(timer)
    timer = setTimeout(run, wait)
  }, { immediate: true })
}

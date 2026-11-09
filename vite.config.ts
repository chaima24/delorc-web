import { globSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import vueDevTools from 'vite-plugin-vue-devtools'

/**
 * Tabler icons without the internet and without the whole 2 MB set: a production build keeps
 * only the icons named `tabler-…` in src/. The dev server and tests get them all.
 */
function tablerIcons(): Plugin {
  const id = 'virtual:tabler-icons'
  let building = false

  return {
    name: 'tabler-icons',
    config: (_, env) => {
      building = env.command === 'build'
    },
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load(resolved) {
      if (resolved !== `\0${id}`) {
        return
      }

      const file = new URL('./node_modules/@iconify-json/tabler/icons.json', import.meta.url)
      const set = JSON.parse(readFileSync(file, 'utf8'))

      if (building) {
        const source = globSync('src/**/*.{vue,ts}').map((path) => readFileSync(path, 'utf8'))
        const names = source.flatMap((text) => [...text.matchAll(/tabler-([a-z0-9-]+)/g)].map((match) => match[1]))
        const aliases = Object.entries<{ parent: string }>(set.aliases ?? {}).filter(([name]) => names.includes(name))
        const kept = new Set([...names, ...aliases.map(([, alias]) => alias.parent)])

        set.icons = Object.fromEntries(Object.entries(set.icons).filter(([name]) => kept.has(name)))
        set.aliases = Object.fromEntries(aliases)
      }

      return `export default ${JSON.stringify(set)}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), vueDevTools(), tablerIcons()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Central console = localhost:5173; a lab = {lab}.localhost:5173.
    host: true,
    port: 5173,
  },
})

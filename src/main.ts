import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { i18n } from './plugins/i18n'
import router from './router'
import { space } from './space'
import { useLabStore } from './stores/lab'
import './styles/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)

/** A lab first reads its name, languages and texts. Without network it still opens, with the central texts. */
if (!space.isCentral) {
  await useLabStore().load().catch(() => undefined)
}

app.use(router)
app.mount('#app')

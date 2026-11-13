import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import './composables/useTheme'
import { i18n } from './plugins/i18n'
import router from './router'
import { space } from './space'
import { useLabStore } from './stores/lab'
import './styles/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)

/** A lab first reads its name, languages and texts, so the first page already shows them. */
if (!space.isCentral) {
  await useLabStore().load() // the router guard then reuses it
}

app.use(router)
app.mount('#app')

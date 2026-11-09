import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import './composables/useTheme'
import { i18n } from './plugins/i18n'
import router from './router'
import './styles/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)
app.use(router)

app.mount('#app')

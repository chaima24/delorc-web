# Delorc — web app

Field CRM for pharmaceutical manufacturers (multi-tenant). This is the web front end; the API lives in `delorc-api`.

Stack: Vue 3 (`<script setup lang="ts">`), Vite, Tailwind CSS 4, Reka UI, Pinia, Vue Router, vue-i18n, Vitest.

```bash
npm install
npm run dev        # central: http://localhost:5173, lab: http://{lab}.localhost:5173
npm run build
npm run test:unit
npm run type-check
```

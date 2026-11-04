# Delorc web

The web app of Delorc. It has no database: it calls `../delorc-api` and shows the answer. Workspace rules: `../CLAUDE.md`. Design: `docs/design/DESIGN_SYSTEM.md` and its mockups.

## Stack

Vue 3 (`<script setup lang="ts">`), Vite, Tailwind CSS 4, Reka UI, Pinia, Vue Router, vue-i18n, axios, Vitest.

## How we work

- The user is a backend developer, new to frontend: baby steps, one decision at a time, simple words, a backend comparison and a concrete example. Wait for an OK between steps.
- Keep the packages already installed; suggest a new one only with a reason.
- Commit only when asked.

## One app, two shells

The address decides what opens: `localhost:5173` is the central console, `{lab}.localhost:5173` is a lab. Never write a domain in the code; read it from the browser.

## Folders

- `src/api/` calls to the API (`central/`, `tenant/`)
- `src/stores/` shared data (Pinia)
- `src/router/` URLs and guards
- `src/layouts/` the shells, written once: central, lab, sign-in
- `src/views/` pages (`auth/`, `central/`, `tenant/`)
- `src/components/` reusable pieces, including the Dl* kit
- `src/composables/` reusable logic
- `src/plugins/` app setup (i18n)
- `src/styles/` Tailwind and design tokens
- `src/space.ts` central or lab, read from the address

## Rules

- A shell or a component is written once and reused, never rebuilt for a page.
- Colours come from the `dl-*` tokens, never written by hand.
- Every API call goes through `src/api/client.ts`, which adds the token and the language and refreshes the session. A page never calls axios directly.
- A page needs a session unless its route has `meta: { public: true }`.
- Texts come from translations, never written in a page. The placeholder login page is the only exception until i18n is set up.
- Copying from the previous front follows the rules in `../CLAUDE.md`.
- Wording: "professionnels de santé", not "clients".
- No real lab name in code or tests: use `demo`.

## Commands

- `npm run dev` runs the app. Browsers open `localhost` and `{lab}.localhost` by themselves, so `/etc/hosts` needs nothing.
- `npm run test:unit -- --run`, `npm run type-check`, `npm run build-only`.

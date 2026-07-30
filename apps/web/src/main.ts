// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import 'element-plus/dist/index.css'

import { loadCadFluxViewerI18n } from '@cadflux/renderer-webgl'
import { createApp } from 'vue'

import App from './App.vue'

async function bootstrap() {
  const app = createApp(App)
  app.use(await loadCadFluxViewerI18n())
  app.mount('#app')
}

void bootstrap()

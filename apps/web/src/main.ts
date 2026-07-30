// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import 'element-plus/dist/index.css'

import { i18n } from '@mlightcad/cad-viewer'
import { createApp } from 'vue'

import App from './App.vue'

const app = createApp(App)
app.use(i18n)
app.mount('#app')

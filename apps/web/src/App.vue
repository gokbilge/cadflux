<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <h1>CadFlux</h1>
        <p>Local-first DWG/DXF viewing with shared CadFlux profiles.</p>
      </div>

      <div class="actions">
        <button class="primary" @click="openFiles">Open Files</button>
        <button class="secondary" @click="openDirectory">Open Directory</button>
      </div>

      <input
        ref="fileInput"
        class="hidden"
        type="file"
        accept=".dwg,.dxf"
        multiple
        @change="onFileChange"
      />
      <input
        ref="directoryInput"
        class="hidden"
        type="file"
        accept=".dwg,.dxf"
        multiple
        webkitdirectory
        @change="onDirectoryChange"
      />

      <label class="field">
        <span>Preset</span>
        <select v-model="selectedPresetId">
          <option
            v-for="preset in presets"
            :key="preset.id"
            :value="preset.id"
          >
            {{ preset.label }}
          </option>
        </select>
      </label>

      <div class="notice">
        Browser batch output depends on browser file APIs. Direct directory
        writing is not available in all browsers, so CadFlux currently treats the
        browser app as the interactive viewer surface and the CLI as the
        unrestricted batch surface.
      </div>

      <div class="queue">
        <div class="queue-header">
          <h2>Queue</h2>
          <span>{{ queue.length }}</span>
        </div>
        <button
          v-for="item in queue"
          :key="item.key"
          class="queue-item"
          :class="{ active: item.key === activeKey }"
          @click="selectItem(item.key)"
        >
          <span>{{ item.file.name }}</span>
          <small>{{ item.relativePath }}</small>
        </button>
      </div>
    </aside>

    <main class="content">
      <div v-if="activeFile == null" class="empty-state">
        <h2>Open a DWG or DXF file</h2>
        <p>Use file selection, drag multiple files in later, or switch to the CLI for unrestricted directory conversion.</p>
      </div>
      <div v-else class="viewer-area">
        <div class="toolbar">
          <div>
            <strong>{{ activeFile.name }}</strong>
            <div class="muted">{{ activeRelativePath }}</div>
          </div>
          <div class="toolbar-actions">
            <button class="secondary" @click="exportSvg">Export SVG</button>
            <button class="primary" @click="exportPdf">Export PDF</button>
          </div>
        </div>

        <MlCadViewer
          :key="viewerKey"
          locale="en"
          :local-file="activeFile"
          :mode="openMode"
          :base-url="baseUrl"
          @create="onViewerCreate"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { CADFLUX_WEB_BASE_URL } from '@cadflux/config'
import { createDrawingHandle } from '@cadflux/drawing-model'
import { browserFilesToInputs } from '@cadflux/file-ingest'
import { CADFLUX_PRESETS } from '@cadflux/presets'
import { registerLazyPdfPlugin } from '@mlightcad/cad-pdf-plugin/register'
import {
  AcApDocManager,
  type AcApPluginManager,
  AcEdOpenMode
} from '@mlightcad/cad-simple-viewer'
import { registerLazySvgPlugin } from '@mlightcad/cad-svg-plugin/register'
import { MlCadViewer } from '@mlightcad/cad-viewer'
import { computed, onMounted, ref, watch } from 'vue'

interface QueueItem {
  key: string
  file: File
  relativePath: string
}

const baseUrl = CADFLUX_WEB_BASE_URL
const openMode = AcEdOpenMode.Read
const presets = CADFLUX_PRESETS

const fileInput = ref<HTMLInputElement | null>(null)
const directoryInput = ref<HTMLInputElement | null>(null)
const queue = ref<QueueItem[]>([])
const activeKey = ref<string | null>(null)
const selectedPresetId = ref<string>(presets[0]?.id ?? 'a4-fit-pdf')

const activeItem = computed(() =>
  queue.value.find(item => item.key === activeKey.value) ?? null
)
const activeFile = computed(() => activeItem.value?.file ?? null)
const activeRelativePath = computed(
  () => activeItem.value?.relativePath ?? 'No active file'
)
const viewerKey = computed(
  () =>
    activeItem.value == null
      ? 'empty'
      : `${activeItem.value.key}:${selectedPresetId.value}`
)

onMounted(async () => {
  const stored = await loadPreference('selectedPresetId')
  if (typeof stored === 'string' && presets.some(preset => preset.id === stored)) {
    selectedPresetId.value = stored
  }
})

watch(selectedPresetId, value => {
  void savePreference('selectedPresetId', value)
})

function openFiles() {
  fileInput.value?.click()
}

function openDirectory() {
  directoryInput.value?.click()
}

function onFileChange(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files) {
    return
  }
  addFiles(Array.from(files))
  ;(event.target as HTMLInputElement).value = ''
}

function onDirectoryChange(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files) {
    return
  }
  addFiles(Array.from(files))
  ;(event.target as HTMLInputElement).value = ''
}

function addFiles(files: File[]) {
  const inputs = browserFilesToInputs(files)
  const nextItems = inputs.map(input => ({
    key: createDrawingHandle(input).id,
    file: input.browserFile as File,
    relativePath: input.relativePath ?? input.name
  }))
  queue.value = dedupeQueue([...queue.value, ...nextItems])
  if (!activeKey.value && queue.value[0]) {
    activeKey.value = queue.value[0].key
  }
}

function selectItem(key: string) {
  activeKey.value = key
}

function onViewerCreate() {
  const pluginManager = AcApDocManager.instance.pluginManager
  registerCadFluxExportPlugins(pluginManager)
}

function exportSvg() {
  void AcApDocManager.instance.sendStringToExecute('csvg')
}

function exportPdf() {
  void AcApDocManager.instance.sendStringToExecute('cpdf')
}

function registerCadFluxExportPlugins(pluginManager: AcApPluginManager) {
  registerLazySvgPlugin(pluginManager)
  registerLazyPdfPlugin(pluginManager)
}

function dedupeQueue(items: QueueItem[]): QueueItem[] {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.key)) {
      return false
    }
    seen.add(item.key)
    return true
  })
}

async function openPreferenceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cadflux-web', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('settings')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function savePreference(key: string, value: string): Promise<void> {
  const db = await openPreferenceDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite')
    tx.objectStore('settings').put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function loadPreference(key: string): Promise<unknown> {
  const db = await openPreferenceDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly')
    const request = tx.objectStore('settings').get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
</script>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 320px 1fr;
  min-height: 100vh;
  background: linear-gradient(180deg, #f3efe7 0%, #e1dbcf 100%);
  color: #1f2a26;
}

.sidebar {
  padding: 24px;
  border-right: 1px solid rgba(31, 42, 38, 0.12);
  background: rgba(255, 251, 243, 0.9);
  backdrop-filter: blur(18px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.brand h1,
.queue-header h2,
.empty-state h2 {
  margin: 0;
  font-family: Georgia, 'Times New Roman', serif;
}

.actions,
.toolbar-actions {
  display: flex;
  gap: 12px;
}

.primary,
.secondary,
select {
  border-radius: 999px;
  border: 1px solid rgba(31, 42, 38, 0.12);
  padding: 10px 16px;
  font: inherit;
}

.primary {
  background: #1f6a53;
  color: #fff;
}

.secondary {
  background: #fff;
  color: #1f2a26;
}

.hidden {
  display: none;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notice {
  padding: 14px;
  border-radius: 18px;
  background: #f8f4ed;
  font-size: 0.9rem;
  line-height: 1.5;
}

.queue {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: auto;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.queue-item {
  text-align: left;
  border: 1px solid rgba(31, 42, 38, 0.12);
  border-radius: 16px;
  padding: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.queue-item.active {
  border-color: #1f6a53;
  box-shadow: 0 0 0 2px rgba(31, 106, 83, 0.15);
}

.content {
  min-width: 0;
}

.empty-state,
.viewer-area {
  height: 100vh;
}

.empty-state {
  display: grid;
  place-items: center;
  text-align: center;
  padding: 24px;
}

.viewer-area {
  display: grid;
  grid-template-rows: auto 1fr;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid rgba(31, 42, 38, 0.08);
}

.muted,
.queue-item small {
  color: rgba(31, 42, 38, 0.68);
}

@media (max-width: 960px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: 0;
    border-bottom: 1px solid rgba(31, 42, 38, 0.12);
  }
}
</style>

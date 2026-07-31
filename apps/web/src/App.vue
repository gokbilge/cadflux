<template>
  <div
    class="shell"
    @dragenter.prevent="isDragActive = true"
    @dragover.prevent="isDragActive = true"
    @dragleave.prevent="isDragActive = false"
    @drop.prevent="onDrop"
  >
    <aside class="sidebar">
      <div class="brand">
        <h1>CadFlux</h1>
        <p>Local-first DWG/DXF viewing and browser batch export.</p>
      </div>

      <div class="actions">
        <button class="primary" @click="openFiles">Open Files</button>
        <button class="secondary" @click="openDirectory">Open Directory</button>
        <button class="secondary" @click="selectOutputDirectory">
          Pick Output Directory
        </button>
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
          <option v-for="preset in presets" :key="preset.id" :value="preset.id">
            {{ preset.label }}
          </option>
        </select>
      </label>

      <div class="field">
        <span>Batch formats</span>
        <label class="checkbox-row">
          <input v-model="batchPdfEnabled" type="checkbox" />
          <span>PDF</span>
        </label>
        <label class="checkbox-row">
          <input v-model="batchSvgEnabled" type="checkbox" />
          <span>SVG</span>
        </label>
      </div>

      <div class="field">
        <span>Persistence</span>
        <label class="checkbox-row">
          <input v-model="workspacePersistenceEnabled" type="checkbox" />
          <span>Persist queue metadata and reports in IndexedDB</span>
        </label>
        <label class="checkbox-row">
          <input v-model="persistOutputHandle" type="checkbox" />
          <span>Remember output directory handle where supported</span>
        </label>
      </div>

      <div class="notice">
        <p class="notice-title">Output strategy</p>
        <p>
          {{
            supportsDirectoryOutput
              ? outputDirectoryHandle
                ? 'Direct filesystem output is enabled through the File System Access API.'
                : 'This browser can write directly to a chosen output directory after permission is granted.'
              : 'This browser cannot write directly to arbitrary local folders, so CadFlux will generate a ZIP download for batch output.'
          }}
        </p>
        <p v-if="outputDirectorySummary" class="muted">
          Output target: {{ outputDirectorySummary }}
        </p>
      </div>

      <div class="batch-panel">
        <div class="queue-header">
          <h2>Batch</h2>
          <span>{{ queue.length }}</span>
        </div>
        <div class="actions batch-actions">
          <button class="primary" :disabled="!canRunBatch" @click="runBatch">
            Run Batch
          </button>
          <button
            class="secondary"
            :disabled="!batchState.isRunning"
            @click="togglePauseBatch"
          >
            {{ batchState.isPaused ? 'Resume' : 'Pause' }}
          </button>
          <button
            class="secondary"
            :disabled="!batchState.isRunning"
            @click="cancelBatch"
          >
            Cancel
          </button>
          <button
            class="secondary"
            :disabled="!hasFailedItems"
            @click="retryFailedItems"
          >
            Retry Failed
          </button>
        </div>
        <div class="muted">
          {{
            batchState.isRunning
              ? `Running ${batchState.completedCount}/${batchState.totalCount}`
              : latestBatchSummary
          }}
        </div>
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
          <span>{{ item.title }}</span>
          <small>{{ item.relativePath }}</small>
          <small>{{ item.status }}</small>
          <small v-if="!item.sourceAvailable" class="error-text">
            Re-add source file to reopen
          </small>
          <small v-if="item.lastError" class="error-text">{{ item.lastError }}</small>
        </button>
      </div>

      <div class="storage-panel">
        <div class="queue-header">
          <h2>Workspace</h2>
          <span>{{ storageUsageSummary }}</span>
        </div>
        <div class="actions batch-actions">
          <button class="secondary" @click="downloadLatestZip" :disabled="latestCachedZip == null">
            Download Latest ZIP
          </button>
          <button class="secondary" @click="exportLatestReports" :disabled="latestReport == null">
            Export Reports
          </button>
        </div>
        <div class="actions batch-actions">
          <button class="secondary" @click="clearWorkspace">Clear Workspace</button>
          <button class="secondary" @click="clearCachedOutputsOnly">
            Clear Cached Outputs
          </button>
          <button class="secondary" @click="clearSavedHandlesOnly">
            Clear Saved Handles
          </button>
          <button class="secondary" @click="clearReportsOnly">Clear Reports</button>
        </div>
      </div>
    </aside>

    <main class="content">
      <div v-if="isDragActive" class="drop-overlay">
        Drop DWG or DXF files here
      </div>
      <div v-if="activeFile == null" class="empty-state">
        <h2>Open a DWG or DXF file</h2>
        <p>
          Use file selection, drag multiple files in, pick a directory, or run a
          browser batch job that writes to a folder or downloads a ZIP bundle.
        </p>
      </div>
      <div v-else class="viewer-area">
        <div class="toolbar">
          <div>
            <strong>{{ activeFile.name }}</strong>
            <div class="muted">{{ activeRelativePath }}</div>
          </div>
          <div class="toolbar-actions">
            <button class="secondary" @click="exportActive('svg')">Export SVG</button>
            <button class="primary" @click="exportActive('pdf')">Export PDF</button>
          </div>
        </div>

        <CadViewerComponent
          v-if="viewerRuntime != null"
          :key="viewerKey"
          locale="en"
          :local-file="activeFile"
          :mode="openMode"
          :base-url="baseUrl"
          @create="onViewerCreate"
          @document-opened="onDocumentOpened"
        />
        <div v-else class="viewer-loading">Loading viewer…</div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { computed, defineAsyncComponent, onMounted, ref, shallowRef, watch } from 'vue'

import {
  createZipBundle,
  createBatchReportArtifacts,
  downloadBlob,
  formatBytes,
  writeArtifactsToDirectory,
  type WebBatchArtifact,
  type WebBatchReport
} from './batch'
import {
  clearCachedOutputs,
  clearPersistedQueue,
  clearSavedHandles,
  clearStoredReports,
  estimateBrowserStorage,
  getCachedOutput,
  listStoredReports,
  loadAppSettings,
  loadOutputDirectoryHandle,
  loadPersistedQueue,
  saveAppSettings,
  saveCachedOutput,
  saveOutputDirectoryHandle,
  savePersistedQueue,
  saveStoredReport,
  type PersistedQueueItem,
  type WebAppSettings,
  type WebBatchReportRecord
} from './storage'
import { CADFLUX_WEB_BASE_URL } from '@cadflux/config'
import { type CadFluxFormat, type CadFluxProfile } from '@cadflux/core'
import { createDrawingHandle } from '@cadflux/drawing-model'
import { browserFilesToInputs } from '@cadflux/file-ingest'
import { CADFLUX_PRESETS } from '@cadflux/presets'
import {
  loadCadFluxViewerComponent,
  loadCadFluxViewerRuntime,
  type CadFluxViewerRuntime
} from '@cadflux/renderer-webgl'

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<FileSystemDirectoryHandle>
}

interface QueueItem {
  key: string
  title: string
  file: File | null
  relativePath: string
  sizeBytes: number
  lastModifiedMs: number
  sourceAvailable: boolean
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  attempts: number
  lastError?: string
  artifacts: Array<{
    format: CadFluxFormat
    relativeOutputPath: string
    sizeBytes: number
  }>
}

interface StoredDocumentOpenedEvent {
  fileName: string
  success: boolean
}

interface BatchState {
  isRunning: boolean
  isPaused: boolean
  cancelRequested: boolean
  completedCount: number
  totalCount: number
}

const baseUrl = CADFLUX_WEB_BASE_URL
const presets = CADFLUX_PRESETS
const CadViewerComponent = defineAsyncComponent(
  () => loadCadFluxViewerComponent() as Promise<any>
)

const DEFAULT_SETTINGS: WebAppSettings = {
  selectedPresetId: presets[0]?.id ?? 'a4-fit-pdf',
  batchFormats: ['pdf'],
  workspacePersistenceEnabled: true,
  persistOutputHandle: false,
  preferredOutputStrategy: 'zip'
}

const fileInput = ref<HTMLInputElement | null>(null)
const directoryInput = ref<HTMLInputElement | null>(null)
const queue = ref<QueueItem[]>([])
const activeKey = ref<string | null>(null)
const selectedPresetId = ref<string>(DEFAULT_SETTINGS.selectedPresetId)
const viewerRuntime = shallowRef<CadFluxViewerRuntime | null>(null)
const batchPdfEnabled = ref(true)
const batchSvgEnabled = ref(false)
const workspacePersistenceEnabled = ref(DEFAULT_SETTINGS.workspacePersistenceEnabled)
const persistOutputHandle = ref(DEFAULT_SETTINGS.persistOutputHandle)
const isDragActive = ref(false)
const latestReport = ref<WebBatchReportRecord | null>(null)
const latestCachedZip = ref<{ fileName: string; blob: Blob } | null>(null)
const outputDirectoryHandle = shallowRef<FileSystemDirectoryHandle | null>(null)
const storageUsage = ref({ usageBytes: 0, quotaBytes: 0 })
const batchState = ref<BatchState>({
  isRunning: false,
  isPaused: false,
  cancelRequested: false,
  completedCount: 0,
  totalCount: 0
})

let pendingDocumentOpen:
  | {
      key: string
      resolve: (value: boolean) => void
    }
  | null = null

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
const openMode = computed(() => viewerRuntime.value?.readMode)
const selectedProfile = computed<CadFluxProfile | null>(
  () => presets.find(preset => preset.id === selectedPresetId.value) ?? null
)
const selectedBatchFormats = computed<CadFluxFormat[]>(() => {
  const formats: CadFluxFormat[] = []
  if (batchPdfEnabled.value) {
    formats.push('pdf')
  }
  if (batchSvgEnabled.value) {
    formats.push('svg')
  }
  return formats
})
const supportsDirectoryOutput = computed(
  () => typeof window !== 'undefined' && 'showDirectoryPicker' in window
)
const outputDirectorySummary = computed(() =>
  outputDirectoryHandle.value?.name ? outputDirectoryHandle.value.name : ''
)
const canRunBatch = computed(
  () =>
    !batchState.value.isRunning &&
    queue.value.some(item => item.sourceAvailable) &&
    selectedBatchFormats.value.length > 0 &&
    viewerRuntime.value != null
)
const hasFailedItems = computed(() =>
  queue.value.some(item => item.status === 'failed')
)
const latestBatchSummary = computed(() => {
  if (!latestReport.value) {
    return 'No batch run yet.'
  }
  return `${latestReport.value.successCount}/${latestReport.value.itemCount} completed on ${new Date(
    latestReport.value.createdAt
  ).toLocaleString()}`
})
const storageUsageSummary = computed(() =>
  storageUsage.value.quotaBytes > 0
    ? `${formatBytes(storageUsage.value.usageBytes)} / ${formatBytes(
        storageUsage.value.quotaBytes
      )}`
    : formatBytes(storageUsage.value.usageBytes)
)

onMounted(async () => {
  viewerRuntime.value = await loadCadFluxViewerRuntime()
  const settings = (await loadAppSettings()) ?? DEFAULT_SETTINGS
  selectedPresetId.value = settings.selectedPresetId
  batchPdfEnabled.value = settings.batchFormats.includes('pdf')
  batchSvgEnabled.value = settings.batchFormats.includes('svg')
  workspacePersistenceEnabled.value = settings.workspacePersistenceEnabled
  persistOutputHandle.value = settings.persistOutputHandle

  const restoredQueue = await loadPersistedQueue()
  if (restoredQueue.length > 0) {
    queue.value = restoredQueue.map(fromPersistedQueueItem)
    activeKey.value = queue.value[0]?.key ?? null
  }

  const reports = await listStoredReports()
  latestReport.value = reports[0] ?? null
  if (latestReport.value?.cachedZipOutputId) {
    const cached = await getCachedOutput(latestReport.value.cachedZipOutputId)
    if (cached) {
      latestCachedZip.value = {
        fileName: cached.fileName,
        blob: cached.blob
      }
    }
  }

  if (settings.persistOutputHandle) {
    outputDirectoryHandle.value = await loadOutputDirectoryHandle()
  }

  await refreshStorageEstimate()
})

watch(
  [
    selectedPresetId,
    batchPdfEnabled,
    batchSvgEnabled,
    workspacePersistenceEnabled,
    persistOutputHandle
  ],
  async () => {
    const settings: WebAppSettings = {
      selectedPresetId: selectedPresetId.value,
      batchFormats: selectedBatchFormats.value,
      workspacePersistenceEnabled: workspacePersistenceEnabled.value,
      persistOutputHandle: persistOutputHandle.value,
      preferredOutputStrategy: outputDirectoryHandle.value ? 'filesystem' : 'zip'
    }
    await saveAppSettings(settings)

    if (!workspacePersistenceEnabled.value) {
      await clearPersistedQueue()
    } else {
      await persistQueueMetadata()
    }

    if (persistOutputHandle.value) {
      await saveOutputDirectoryHandle(outputDirectoryHandle.value)
    } else {
      await saveOutputDirectoryHandle(null)
    }
  },
  { deep: true }
)

watch(
  queue,
  () => {
    void persistQueueMetadata()
  },
  { deep: true }
)

function openFiles() {
  fileInput.value?.click()
}

async function openDirectory() {
  const pickerWindow = window as WindowWithDirectoryPicker
  if (
    supportsDirectoryOutput.value &&
    typeof pickerWindow.showDirectoryPicker === 'function'
  ) {
    try {
      const handle = await pickerWindow.showDirectoryPicker({ mode: 'read' })
      const files = await collectFilesFromDirectoryHandle(handle)
      addFiles(files)
      return
    } catch {
      // User cancelled or browser rejected access. Fall back below.
    }
  }

  directoryInput.value?.click()
}

async function selectOutputDirectory() {
  const pickerWindow = window as WindowWithDirectoryPicker
  if (typeof pickerWindow.showDirectoryPicker !== 'function') {
    return
  }

  try {
    const handle = await pickerWindow.showDirectoryPicker({
      mode: 'readwrite'
    })
    outputDirectoryHandle.value = handle
    if (persistOutputHandle.value) {
      await saveOutputDirectoryHandle(handle)
    }
  } catch {
    // ignore cancel
  }
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

function onDrop(event: DragEvent) {
  isDragActive.value = false
  const files = event.dataTransfer?.files
  if (!files?.length) {
    return
  }
  addFiles(Array.from(files))
}

function addFiles(files: File[]) {
  const inputs = browserFilesToInputs(files)
  const nextItems = inputs.map(input => ({
    key: createDrawingHandle(input).id,
    title: input.name,
    file: input.browserFile as File,
    relativePath: input.relativePath ?? input.name,
    sizeBytes: input.sizeBytes ?? 0,
    lastModifiedMs: input.lastModifiedMs ?? 0,
    sourceAvailable: true,
    status: 'idle' as const,
    attempts: 0,
    artifacts: []
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
  viewerRuntime.value?.viewerCreated()
}

function onDocumentOpened(event: StoredDocumentOpenedEvent) {
  if (pendingDocumentOpen && activeItem.value?.key === pendingDocumentOpen.key) {
    pendingDocumentOpen.resolve(event.success)
    pendingDocumentOpen = null
  }
}

async function exportActive(format: CadFluxFormat) {
  if (!viewerRuntime.value || !activeItem.value?.sourceAvailable) {
    return
  }
  await viewerRuntime.value.execute(format === 'pdf' ? 'cpdf' : 'csvg')
}

async function runBatch() {
  await runBatchForItems(queue.value.filter(item => item.sourceAvailable))
}

async function retryFailedItems() {
  await runBatchForItems(
    queue.value.filter(
      item => item.sourceAvailable && item.status === 'failed'
    )
  )
}

async function runBatchForItems(items: QueueItem[]) {
  if (!viewerRuntime.value || items.length === 0 || selectedProfile.value == null) {
    return
  }

  batchState.value = {
    isRunning: true,
    isPaused: false,
    cancelRequested: false,
    completedCount: 0,
    totalCount: items.length
  }

  const artifactsForZip: WebBatchArtifact[] = []
  const batchItems = items.map(item => item.key)
  const outputStrategy =
    supportsDirectoryOutput.value && outputDirectoryHandle.value != null
      ? 'filesystem'
      : 'zip'

  for (const item of queue.value) {
    if (batchItems.includes(item.key)) {
      item.status = 'idle'
      item.lastError = undefined
      item.artifacts = []
    }
  }

  for (const item of items) {
    if (batchState.value.cancelRequested) {
      item.status = 'cancelled'
      continue
    }

    while (batchState.value.isPaused && !batchState.value.cancelRequested) {
      await delay(150)
    }

    item.status = 'running'
    item.attempts += 1
    item.lastError = undefined
    item.artifacts = []

    const ready = await ensureViewerLoadedForItem(item)
    if (!ready || !viewerRuntime.value) {
      item.status = 'failed'
      item.lastError = 'Failed to open drawing in the browser viewer.'
      batchState.value.completedCount += 1
      continue
    }

    try {
      for (const format of selectedBatchFormats.value) {
        const exportResult = await viewerRuntime.value.exportCurrent(
          format === 'pdf' ? 'cpdf' : 'csvg'
        )
        const relativeOutputPath = resolveOutputPath(item.relativePath, exportResult.downloadName)
        item.artifacts.push({
          format: exportResult.format,
          relativeOutputPath,
          sizeBytes: exportResult.blob.size
        })

        artifactsForZip.push({
          format: exportResult.format,
          downloadName: exportResult.downloadName,
          relativeOutputPath,
          blob: exportResult.blob
        })
      }

      item.status = 'completed'
    } catch (error) {
      item.status = 'failed'
      item.lastError = error instanceof Error ? error.message : String(error)
    } finally {
      batchState.value.completedCount += 1
    }
  }

  const report = createReport(outputStrategy)
  const reportArtifacts = createBatchReportArtifacts(report)
  if (
    outputStrategy === 'filesystem' &&
    outputDirectoryHandle.value != null &&
    artifactsForZip.length > 0
  ) {
    await writeArtifactsToDirectory(
      outputDirectoryHandle.value,
      artifactsForZip,
      reportArtifacts
    )
  }

  const cachedZipOutputId =
    outputStrategy === 'zip'
      ? await finalizeZipOutput(artifactsForZip, reportArtifacts, report.id)
      : undefined

  const record: WebBatchReportRecord = {
    id: report.id,
    createdAt: report.createdAt,
    presetId: report.presetId,
    strategy: report.strategy,
    formatIds: report.formatIds,
    itemCount: report.items.length,
    successCount: report.items.filter(item => item.status === 'completed').length,
    failureCount: report.items.filter(item => item.status === 'failed').length,
    manifestJson: reportArtifacts.manifest,
    reportJson: reportArtifacts.json,
    reportCsv: reportArtifacts.csv,
    reportHtml: reportArtifacts.html,
    cachedZipOutputId
  }
  latestReport.value = record

  if (workspacePersistenceEnabled.value) {
    await saveStoredReport(record)
  }

  batchState.value = {
    isRunning: false,
    isPaused: false,
    cancelRequested: false,
    completedCount: batchState.value.completedCount,
    totalCount: batchState.value.totalCount
  }
  await persistQueueMetadata()
  await refreshStorageEstimate()
}

function togglePauseBatch() {
  batchState.value.isPaused = !batchState.value.isPaused
}

function cancelBatch() {
  batchState.value.cancelRequested = true
}

async function downloadLatestZip() {
  if (latestCachedZip.value) {
    downloadBlob(latestCachedZip.value.blob, latestCachedZip.value.fileName)
  }
}

function exportLatestReports() {
  if (!latestReport.value) {
    return
  }

  downloadBlob(
    new Blob([latestReport.value.reportJson], {
      type: 'application/json'
    }),
    `cadflux-report-${latestReport.value.id}.json`
  )
  downloadBlob(
    new Blob([latestReport.value.reportCsv], {
      type: 'text/csv;charset=utf-8'
    }),
    `cadflux-report-${latestReport.value.id}.csv`
  )
  downloadBlob(
    new Blob([latestReport.value.reportHtml], {
      type: 'text/html;charset=utf-8'
    }),
    `cadflux-report-${latestReport.value.id}.html`
  )
  downloadBlob(
    new Blob([latestReport.value.manifestJson], {
      type: 'application/json'
    }),
    `cadflux-manifest-${latestReport.value.id}.json`
  )
}

async function clearWorkspace() {
  queue.value = []
  activeKey.value = null
  latestReport.value = null
  latestCachedZip.value = null
  outputDirectoryHandle.value = null
  await clearPersistedQueue()
  await clearStoredReports()
  await clearCachedOutputs()
  await clearSavedHandles()
  await refreshStorageEstimate()
}

async function clearCachedOutputsOnly() {
  latestCachedZip.value = null
  await clearCachedOutputs()
  await refreshStorageEstimate()
}

async function clearSavedHandlesOnly() {
  outputDirectoryHandle.value = null
  await clearSavedHandles()
  await refreshStorageEstimate()
}

async function clearReportsOnly() {
  latestReport.value = null
  await clearStoredReports()
  await refreshStorageEstimate()
}

async function ensureViewerLoadedForItem(item: QueueItem): Promise<boolean> {
  if (activeKey.value !== item.key) {
    activeKey.value = item.key
  }
  if (!item.file) {
    return false
  }

  return new Promise<boolean>(resolve => {
    pendingDocumentOpen = {
      key: item.key,
      resolve
    }
    if (activeItem.value?.key === item.key && activeFile.value === item.file) {
      window.setTimeout(() => {
        if (pendingDocumentOpen?.key === item.key) {
          pendingDocumentOpen.resolve(true)
          pendingDocumentOpen = null
        }
      }, 150)
    }
  })
}

function createReport(strategy: 'filesystem' | 'zip'): WebBatchReport {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    presetId: selectedPresetId.value,
    strategy,
    formatIds: selectedBatchFormats.value,
    items: queue.value
      .filter(item => item.attempts > 0)
      .map(item => ({
        title: item.title,
        relativePath: item.relativePath,
        status:
          item.status === 'running' || item.status === 'idle'
            ? 'cancelled'
            : item.status,
        attempts: item.attempts,
        error: item.lastError,
        artifacts: item.artifacts.map(artifact => ({ ...artifact }))
      }))
  }
}

async function finalizeZipOutput(
  artifacts: WebBatchArtifact[],
  reportArtifacts: {
    manifest: string
    json: string
    csv: string
    html: string
  },
  reportId: string
): Promise<string | undefined> {
  const zip = await createZipBundle('cadflux-output.zip', artifacts, reportArtifacts)
  latestCachedZip.value = zip

  if (workspacePersistenceEnabled.value) {
    const outputId = `zip:${reportId}`
    await saveCachedOutput({
      id: outputId,
      fileName: zip.fileName,
      createdAt: new Date().toISOString(),
      blob: zip.blob
    })
    return outputId
  }

  downloadBlob(zip.blob, zip.fileName)
  return undefined
}

async function persistQueueMetadata() {
  if (!workspacePersistenceEnabled.value) {
    return
  }
  await savePersistedQueue(queue.value.map(toPersistedQueueItem))
}

async function refreshStorageEstimate() {
  storageUsage.value = await estimateBrowserStorage()
}

function toPersistedQueueItem(item: QueueItem): PersistedQueueItem {
  return {
    key: item.key,
    title: item.title,
    relativePath: item.relativePath,
    sizeBytes: item.sizeBytes,
    lastModifiedMs: item.lastModifiedMs,
    sourceAvailable: item.sourceAvailable,
    status: item.status,
    attempts: item.attempts,
    lastError: item.lastError,
    artifacts: item.artifacts.map(artifact => ({ ...artifact }))
  }
}

function fromPersistedQueueItem(item: PersistedQueueItem): QueueItem {
  return {
    key: item.key,
    title: item.title,
    file: null,
    relativePath: item.relativePath,
    sizeBytes: item.sizeBytes,
    lastModifiedMs: item.lastModifiedMs,
    sourceAvailable: false,
    status: item.status,
    attempts: item.attempts,
    lastError: item.lastError,
    artifacts: item.artifacts.map(artifact => ({ ...artifact }))
  }
}

function dedupeQueue(items: QueueItem[]): QueueItem[] {
  const deduped = new Map<string, QueueItem>()
  for (const item of items) {
    deduped.set(item.key, item)
  }
  return Array.from(deduped.values())
}

function resolveOutputPath(relativeInputPath: string, downloadName: string) {
  const normalized = relativeInputPath.replaceAll('\\', '/')
  const segments = normalized.split('/')
  segments.pop()
  return [...segments, downloadName].filter(Boolean).join('/')
}

async function collectFilesFromDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  prefix = ''
): Promise<File[]> {
  const files: File[] = []

  for await (const [, entry] of (handle as unknown as {
    entries: () => AsyncIterable<[string, FileSystemHandle]>
  }).entries()) {
    if (entry.kind === 'file') {
      const file = await (entry as FileSystemFileHandle).getFile()
      const relativePath = prefix ? `${prefix}/${file.name}` : file.name
      Object.defineProperty(file, 'webkitRelativePath', {
        configurable: true,
        enumerable: true,
        value: relativePath
      })
      files.push(file)
      continue
    }

    files.push(
      ...(await collectFilesFromDirectoryHandle(
        entry as FileSystemDirectoryHandle,
        prefix ? `${prefix}/${entry.name}` : entry.name
      ))
    )
  }

  return files
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}
</script>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 360px 1fr;
  min-height: 100vh;
  background: linear-gradient(180deg, #f3efe7 0%, #e1dbcf 100%);
  color: #1f2a26;
}

.sidebar {
  padding: 24px;
  border-right: 1px solid rgba(31, 42, 38, 0.12);
  background: rgba(255, 251, 243, 0.92);
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
  flex-wrap: wrap;
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

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.92rem;
}

.notice,
.batch-panel,
.storage-panel {
  padding: 14px;
  border-radius: 18px;
  background: #f8f4ed;
  font-size: 0.9rem;
  line-height: 1.5;
}

.notice-title {
  margin: 0 0 6px;
  font-weight: 600;
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

.batch-actions {
  margin-top: 8px;
}

.content {
  min-width: 0;
  position: relative;
}

.drop-overlay {
  position: absolute;
  inset: 16px;
  border: 2px dashed #1f6a53;
  border-radius: 24px;
  background: rgba(31, 106, 83, 0.08);
  display: grid;
  place-items: center;
  z-index: 10;
  font-size: 1.2rem;
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

.viewer-loading {
  display: grid;
  place-items: center;
  color: rgba(31, 42, 38, 0.72);
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

.error-text {
  color: #8b2f2f;
}

@media (max-width: 1080px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: 0;
    border-bottom: 1px solid rgba(31, 42, 38, 0.12);
  }
}
</style>

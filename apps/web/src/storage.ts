// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { openDB } from 'idb'

import type { CadFluxFormat } from '@cadflux/core'

export interface PersistedQueueItem {
  key: string
  title: string
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

export interface WebBatchReportRecord {
  id: string
  createdAt: string
  presetId: string
  strategy: 'filesystem' | 'zip'
  formatIds: CadFluxFormat[]
  itemCount: number
  successCount: number
  failureCount: number
  manifestJson: string
  reportJson: string
  reportCsv: string
  reportHtml: string
  cachedZipOutputId?: string
}

export interface WebCachedOutputRecord {
  id: string
  fileName: string
  createdAt: string
  blob: Blob
}

export interface WebAppSettings {
  selectedPresetId: string
  batchFormats: CadFluxFormat[]
  workspacePersistenceEnabled: boolean
  persistOutputHandle: boolean
  preferredOutputStrategy: 'filesystem' | 'zip'
}

interface CadFluxWebDbSchema {
  settings: {
    key: string
    value: unknown
  }
  queue: {
    key: string
    value: PersistedQueueItem[]
  }
  reports: {
    key: string
    value: WebBatchReportRecord
  }
  outputs: {
    key: string
    value: WebCachedOutputRecord
  }
}

const DB_NAME = 'cadflux-web'
const DB_VERSION = 2
const SETTINGS_KEY = 'app-settings'
const QUEUE_KEY = 'workspace-queue'
const OUTPUT_HANDLE_KEY = 'output-directory-handle'

async function openCadFluxDb() {
  return openDB<CadFluxWebDbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings')
      }
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue')
      }
      if (!db.objectStoreNames.contains('reports')) {
        db.createObjectStore('reports', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('outputs')) {
        db.createObjectStore('outputs', { keyPath: 'id' })
      }
    }
  })
}

export async function loadAppSettings(): Promise<WebAppSettings | null> {
  const db = await openCadFluxDb()
  return ((await db.get('settings', SETTINGS_KEY)) as WebAppSettings | undefined) ?? null
}

export async function saveAppSettings(settings: WebAppSettings): Promise<void> {
  const db = await openCadFluxDb()
  await db.put('settings', settings, SETTINGS_KEY)
}

export async function loadPersistedQueue(): Promise<PersistedQueueItem[]> {
  const db = await openCadFluxDb()
  return ((await db.get('queue', QUEUE_KEY)) as PersistedQueueItem[] | undefined) ?? []
}

export async function savePersistedQueue(
  items: PersistedQueueItem[]
): Promise<void> {
  const db = await openCadFluxDb()
  await db.put('queue', items, QUEUE_KEY)
}

export async function clearPersistedQueue(): Promise<void> {
  const db = await openCadFluxDb()
  await db.delete('queue', QUEUE_KEY)
}

export async function listStoredReports(): Promise<WebBatchReportRecord[]> {
  const db = await openCadFluxDb()
  return (await db.getAll('reports')).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )
}

export async function saveStoredReport(record: WebBatchReportRecord): Promise<void> {
  const db = await openCadFluxDb()
  await db.put('reports', record)
}

export async function deleteStoredReport(id: string): Promise<void> {
  const db = await openCadFluxDb()
  await db.delete('reports', id)
}

export async function clearStoredReports(): Promise<void> {
  const db = await openCadFluxDb()
  await db.clear('reports')
}

export async function saveCachedOutput(record: WebCachedOutputRecord): Promise<void> {
  const db = await openCadFluxDb()
  await db.put('outputs', record)
}

export async function getCachedOutput(
  id: string
): Promise<WebCachedOutputRecord | null> {
  const db = await openCadFluxDb()
  return ((await db.get('outputs', id)) as WebCachedOutputRecord | undefined) ?? null
}

export async function deleteCachedOutput(id: string): Promise<void> {
  const db = await openCadFluxDb()
  await db.delete('outputs', id)
}

export async function clearCachedOutputs(): Promise<void> {
  const db = await openCadFluxDb()
  await db.clear('outputs')
}

export async function pruneStoredReports(maxCount: number): Promise<void> {
  const reports = await listStoredReports()
  if (reports.length <= maxCount) {
    return
  }

  const staleReports = reports.slice(maxCount)
  const db = await openCadFluxDb()
  const transaction = db.transaction(['reports', 'outputs'], 'readwrite')

  for (const report of staleReports) {
    await transaction.objectStore('reports').delete(report.id)
    if (report.cachedZipOutputId) {
      await transaction.objectStore('outputs').delete(report.cachedZipOutputId)
    }
  }

  await transaction.done
}

export async function saveOutputDirectoryHandle(
  handle: FileSystemDirectoryHandle | null
): Promise<void> {
  const db = await openCadFluxDb()
  if (handle == null) {
    await db.delete('settings', OUTPUT_HANDLE_KEY)
    return
  }
  await db.put('settings', handle, OUTPUT_HANDLE_KEY)
}

export async function loadOutputDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openCadFluxDb()
  return ((await db.get('settings', OUTPUT_HANDLE_KEY)) as
    | FileSystemDirectoryHandle
    | undefined) ?? null
}

export async function clearSavedHandles(): Promise<void> {
  const db = await openCadFluxDb()
  await db.delete('settings', OUTPUT_HANDLE_KEY)
}

export async function estimateBrowserStorage(): Promise<{
  usageBytes: number
  quotaBytes: number
}> {
  if (typeof navigator.storage?.estimate !== 'function') {
    return { usageBytes: 0, quotaBytes: 0 }
  }
  const estimate = await navigator.storage.estimate()
  return {
    usageBytes: estimate.usage ?? 0,
    quotaBytes: estimate.quota ?? 0
  }
}

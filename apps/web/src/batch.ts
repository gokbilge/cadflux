// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { zipSync, strToU8 } from 'fflate'

import type { CadFluxFormat } from '@cadflux/core'

export interface WebBatchArtifact {
  format: CadFluxFormat
  downloadName: string
  relativeOutputPath: string
  blob: Blob
}

export interface WebBatchReportItem {
  title: string
  relativePath: string
  status: 'completed' | 'failed' | 'cancelled'
  attempts: number
  error?: string
  artifacts: Array<{
    format: CadFluxFormat
    relativeOutputPath: string
    sizeBytes: number
  }>
}

export interface WebBatchReport {
  id: string
  createdAt: string
  presetId: string
  strategy: 'filesystem' | 'zip'
  formatIds: CadFluxFormat[]
  items: WebBatchReportItem[]
}

export function createBatchReportArtifacts(report: WebBatchReport): {
  json: string
  csv: string
  html: string
  manifest: string
} {
  const json = JSON.stringify(report, null, 2)
  const header = ['title', 'relativePath', 'status', 'attempts', 'artifacts', 'error']
  const rows = report.items.map(item => [
    item.title,
    item.relativePath,
    item.status,
    String(item.attempts),
    item.artifacts.map(artifact => artifact.relativeOutputPath).join('|'),
    item.error ?? ''
  ])
  const csv = [header, ...rows]
    .map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(','))
    .join('\n')

  const htmlRows = report.items
    .map(
      item => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.relativePath)}</td><td>${item.status}</td><td>${item.attempts}</td><td>${item.artifacts
        .map(artifact => escapeHtml(artifact.relativeOutputPath))
        .join('<br/>')}</td><td>${escapeHtml(item.error ?? '')}</td></tr>`
    )
    .join('')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CadFlux Batch Report</title><style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;vertical-align:top}th{background:#f3f3f3;text-align:left}</style></head><body><h1>CadFlux Batch Report</h1><p>Preset: ${escapeHtml(
    report.presetId
  )}</p><table><thead><tr><th>Title</th><th>Relative path</th><th>Status</th><th>Attempts</th><th>Artifacts</th><th>Error</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>`

  const manifest = JSON.stringify(
    {
      createdAt: report.createdAt,
      reportId: report.id,
      presetId: report.presetId,
      strategy: report.strategy,
      formats: report.formatIds,
      outputs: report.items.flatMap(item =>
        item.artifacts.map(artifact => ({
          input: item.relativePath,
          format: artifact.format,
          output: artifact.relativeOutputPath,
          sizeBytes: artifact.sizeBytes
        }))
      )
    },
    null,
    2
  )

  return { json, csv, html, manifest }
}

export async function createZipBundle(
  fileName: string,
  artifacts: WebBatchArtifact[],
  reportFiles: {
    manifest: string
    json: string
    csv: string
    html: string
  }
): Promise<{ fileName: string; blob: Blob }> {
  const zipEntries: Record<string, Uint8Array> = {
    'manifest.json': strToU8(reportFiles.manifest),
    'batch-report.json': strToU8(reportFiles.json),
    'batch-report.csv': strToU8(reportFiles.csv),
    'batch-report.html': strToU8(reportFiles.html)
  }

  for (const artifact of artifacts) {
    zipEntries[artifact.relativeOutputPath] = new Uint8Array(
      await artifact.blob.arrayBuffer()
    )
  }

  const zipBytes = zipSync(zipEntries, { level: 0 })
  return {
    fileName,
    blob: new Blob([zipBytes as unknown as BlobPart], {
      type: 'application/zip'
    })
  }
}

export async function writeArtifactsToDirectory(
  rootHandle: FileSystemDirectoryHandle,
  artifacts: WebBatchArtifact[],
  reportFiles: {
    manifest: string
    json: string
    csv: string
    html: string
  }
): Promise<void> {
  for (const artifact of artifacts) {
    await writeFileToDirectory(
      rootHandle,
      artifact.relativeOutputPath,
      artifact.blob
    )
  }

  await writeFileToDirectory(
    rootHandle,
    'manifest.json',
    new Blob([reportFiles.manifest], { type: 'application/json' })
  )
  await writeFileToDirectory(
    rootHandle,
    'batch-report.json',
    new Blob([reportFiles.json], { type: 'application/json' })
  )
  await writeFileToDirectory(
    rootHandle,
    'batch-report.csv',
    new Blob([reportFiles.csv], { type: 'text/csv;charset=utf-8' })
  )
  await writeFileToDirectory(
    rootHandle,
    'batch-report.html',
    new Blob([reportFiles.html], { type: 'text/html;charset=utf-8' })
  )
}

async function writeFileToDirectory(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
  blob: Blob
): Promise<void> {
  const parts = relativePath.split('/').filter(Boolean)
  const fileName = parts.pop()
  if (!fileName) {
    return
  }

  let currentHandle = rootHandle
  for (const segment of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(segment, {
      create: true
    })
  }

  const fileHandle = await currentHandle.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

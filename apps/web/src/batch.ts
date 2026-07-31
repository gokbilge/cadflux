// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { zipSync, strToU8 } from 'fflate'

import {
  createBatchReportArtifacts,
  type CadFluxBatchReport as WebBatchReport
} from '@cadflux/batch-engine'
import type { CadFluxFormat } from '@cadflux/core'

export { createBatchReportArtifacts }

export interface WebBatchArtifact {
  format: CadFluxFormat
  downloadName: string
  relativeOutputPath: string
  blob: Blob
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

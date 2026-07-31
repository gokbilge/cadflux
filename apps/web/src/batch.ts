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

export type WebBatchCollisionPolicy = 'replace' | 'rename'

export async function createZipBundle(
  fileName: string,
  artifacts: WebBatchArtifact[],
  reportFiles: {
    manifest: string
    json: string
    csv: string
    html: string
  },
  collisionPolicy: WebBatchCollisionPolicy = 'replace'
): Promise<{ fileName: string; blob: Blob }> {
  const zipEntries: Record<string, Uint8Array> = {}
  const assignZipEntry = (relativePath: string, bytes: Uint8Array) => {
    const resolvedPath =
      collisionPolicy === 'rename'
        ? ensureUniqueRelativePath(relativePath, zipEntries)
        : relativePath
    zipEntries[resolvedPath] = bytes
  }

  assignZipEntry('manifest.json', strToU8(reportFiles.manifest))
  assignZipEntry('batch-report.json', strToU8(reportFiles.json))
  assignZipEntry('batch-report.csv', strToU8(reportFiles.csv))
  assignZipEntry('batch-report.html', strToU8(reportFiles.html))

  for (const artifact of artifacts) {
    assignZipEntry(
      artifact.relativeOutputPath,
      new Uint8Array(await artifact.blob.arrayBuffer())
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
  },
  collisionPolicy: WebBatchCollisionPolicy = 'replace'
): Promise<void> {
  for (const artifact of artifacts) {
    await writeFileToDirectory(
      rootHandle,
      artifact.relativeOutputPath,
      artifact.blob,
      collisionPolicy
    )
  }

  await writeFileToDirectory(
    rootHandle,
    'manifest.json',
    new Blob([reportFiles.manifest], { type: 'application/json' }),
    collisionPolicy
  )
  await writeFileToDirectory(
    rootHandle,
    'batch-report.json',
    new Blob([reportFiles.json], { type: 'application/json' }),
    collisionPolicy
  )
  await writeFileToDirectory(
    rootHandle,
    'batch-report.csv',
    new Blob([reportFiles.csv], { type: 'text/csv;charset=utf-8' }),
    collisionPolicy
  )
  await writeFileToDirectory(
    rootHandle,
    'batch-report.html',
    new Blob([reportFiles.html], { type: 'text/html;charset=utf-8' }),
    collisionPolicy
  )
}

async function writeFileToDirectory(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
  blob: Blob,
  collisionPolicy: WebBatchCollisionPolicy
): Promise<void> {
  const parts = relativePath.split('/').filter(Boolean)
  const requestedFileName = parts.pop()
  if (!requestedFileName) {
    return
  }

  let currentHandle = rootHandle
  for (const segment of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(segment, {
      create: true
    })
  }

  const fileName =
    collisionPolicy === 'rename'
      ? await resolveAvailableFileName(currentHandle, requestedFileName)
      : requestedFileName
  const fileHandle = await currentHandle.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
}

function ensureUniqueRelativePath(
  requestedPath: string,
  entries: Record<string, Uint8Array>
): string {
  if (!(requestedPath in entries)) {
    return requestedPath
  }

  const segments = requestedPath.split('/')
  const fileName = segments.pop() ?? requestedPath
  const candidateBasePath = segments.join('/')
  const extensionIndex = fileName.lastIndexOf('.')
  const baseName =
    extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName
  const extension = extensionIndex > 0 ? fileName.slice(extensionIndex) : ''

  let counter = 2
  while (true) {
    const candidateName = `${baseName} (${counter})${extension}`
    const candidatePath = [...segments, candidateName].filter(Boolean).join('/')
    if (!(candidatePath in entries)) {
      return candidateBasePath ? candidatePath : candidateName
    }
    counter += 1
  }
}

async function resolveAvailableFileName(
  directoryHandle: FileSystemDirectoryHandle,
  requestedFileName: string
): Promise<string> {
  if (!(await fileExists(directoryHandle, requestedFileName))) {
    return requestedFileName
  }

  const extensionIndex = requestedFileName.lastIndexOf('.')
  const baseName =
    extensionIndex > 0
      ? requestedFileName.slice(0, extensionIndex)
      : requestedFileName
  const extension =
    extensionIndex > 0 ? requestedFileName.slice(extensionIndex) : ''

  let counter = 2
  while (true) {
    const candidateName = `${baseName} (${counter})${extension}`
    if (!(await fileExists(directoryHandle, candidateName))) {
      return candidateName
    }
    counter += 1
  }
}

async function fileExists(
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<boolean> {
  try {
    await directoryHandle.getFileHandle(fileName)
    return true
  } catch {
    return false
  }
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

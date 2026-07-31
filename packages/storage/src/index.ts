// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { createHash, randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

export interface StoredUploadResult {
  relativePath: string
  storedPath: string
  sizeBytes: number
  checksum: string
  format: string
}

export function sanitizeRelativePath(input: string): string {
  const normalized = input.replace(/\\/g, '/').trim()
  if (!normalized) {
    throw new Error('Relative path is required.')
  }
  if (normalized.includes('\0')) {
    throw new Error('Relative path contains invalid characters.')
  }
  if (/^[a-zA-Z]:/u.test(normalized) || normalized.startsWith('/') || normalized.startsWith('//')) {
    throw new Error('Relative path must not be absolute.')
  }
  const segments = normalized.split('/')
  if (
    segments.some((segment: string) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error('Relative path is not safe.')
  }
  return segments.join('/')
}

export function detectCadFormat(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase()
  if (extension === '.dwg') {
    return 'dwg'
  }
  if (extension === '.dxf') {
    return 'dxf'
  }
  throw new Error('Only DWG and DXF uploads are supported.')
}

export function buildJobStoragePaths(dataDir: string, jobId: string) {
  const jobRoot = path.join(dataDir, 'jobs', jobId)
  return {
    jobRoot,
    inputRoot: path.join(jobRoot, 'input'),
    workingRoot: path.join(jobRoot, 'working'),
    outputRoot: path.join(jobRoot, 'output'),
    logsRoot: path.join(jobRoot, 'logs')
  }
}

export async function storeUploadStream(options: {
  dataDir: string
  jobId: string
  relativePath: string
  originalName: string
  stream: NodeJS.ReadableStream
}): Promise<StoredUploadResult> {
  const safeRelativePath = sanitizeRelativePath(options.relativePath)
  const format = detectCadFormat(options.originalName)
  const storagePaths = buildJobStoragePaths(options.dataDir, options.jobId)
  await mkdir(storagePaths.inputRoot, { recursive: true })

  const extension = path.extname(options.originalName).toLowerCase()
  const storedName = `${randomUUID()}${extension}`
  const storedPath = path.join(storagePaths.inputRoot, storedName)
  const temporaryPath = `${storedPath}.part`
  const hash = createHash('sha256')
  let sizeBytes = 0

  const writable = createWriteStream(temporaryPath, { flags: 'wx' })
  options.stream.on('data', chunk => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    sizeBytes += buffer.length
    hash.update(buffer)
  })

  try {
    await pipeline(options.stream, writable)
    if (sizeBytes <= 0) {
      throw new Error('Uploaded CAD file is empty.')
    }
    await rename(temporaryPath, storedPath)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    await rm(storedPath, { force: true }).catch(() => undefined)
    throw error
  }

  return {
    relativePath: safeRelativePath,
    storedPath,
    sizeBytes,
    checksum: hash.digest('hex'),
    format
  }
}

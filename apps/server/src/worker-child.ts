// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'

import type { CadFluxFormat, CadFluxProfile } from '@cadflux/core'
import { checksumFile } from '@cadflux/core/checksum'
import { inspectDwgInput } from '@cadflux/dwg-adapter'
import { inspectDxfInput } from '@cadflux/dxf-adapter'
import { resolveArtifactOutputPath } from '@cadflux/plot-engine'
import { exportPdfFile } from '@cadflux/renderer-pdf'
import { exportSvgFile } from '@cadflux/renderer-svg'

interface ChildTaskPayload {
  jobId: string
  jobFileId: string
  originalName: string
  storedPath: string
  relativePath: string
  sizeBytes: number
  format: string
  profile: CadFluxProfile
  outputDirectory: string
}

interface ChildArtifactPayload {
  format: CadFluxFormat
  relativePath: string
  storedPath: string
  sizeBytes: number
  checksum: string
  mimeType: string
  fidelity: string
}

type OutboundMessage =
  | { type: 'stage'; stage: 'parsing' | 'rendering' | 'exporting'; progressPercent: number }
  | { type: 'completed'; warnings: string[]; artifacts: ChildArtifactPayload[] }
  | { type: 'failed'; error: string }

async function main(): Promise<void> {
  const raw = process.env.CADFLUX_WORKER_TASK
  if (!raw) {
    throw new Error('Worker task payload missing.')
  }
  const payload = JSON.parse(raw) as ChildTaskPayload
  const input = {
    name: payload.originalName,
    absolutePath: payload.storedPath,
    relativePath: payload.relativePath,
    extension: path.extname(payload.originalName).toLowerCase(),
    sizeBytes: payload.sizeBytes
  }

  try {
    send({ type: 'stage', stage: 'parsing', progressPercent: 10 })
    const inspection =
      payload.format === 'dwg' ? inspectDwgInput(input) : inspectDxfInput(input)
    const warnings = [...inspection.warnings]

    send({ type: 'stage', stage: 'rendering', progressPercent: 35 })
    const artifacts: ChildArtifactPayload[] = []
    for (let index = 0; index < payload.profile.formats.length; index += 1) {
      const format = payload.profile.formats[index]!
      send({
        type: 'stage',
        stage: 'exporting',
        progressPercent: Math.min(95, 50 + Math.round((index / Math.max(1, payload.profile.formats.length)) * 40))
      })
      const outputPath = resolveArtifactOutputPath(
        {
          input,
          outputDirectory: payload.outputDirectory,
          profile: payload.profile,
          preserveTree: true,
          overwrite: 'replace'
        },
        format
      )
      await mkdir(path.dirname(outputPath), { recursive: true })
      if (format === 'pdf') {
        await exportPdfFile(payload.storedPath, outputPath)
      } else {
        await exportSvgFile(payload.storedPath, outputPath)
      }
      const details = await stat(outputPath)
      artifacts.push({
        format,
        relativePath: toPortablePath(path.relative(payload.outputDirectory, outputPath)),
        storedPath: outputPath,
        sizeBytes: details.size,
        checksum: await checksumFile(outputPath),
        mimeType: format === 'pdf' ? 'application/pdf' : 'image/svg+xml',
        fidelity: format === 'pdf' ? 'unknown' : 'vector'
      })
    }

    send({
      type: 'completed',
      warnings,
      artifacts
    })
  } catch (error) {
    send({
      type: 'failed',
      error: error instanceof Error ? error.message : String(error)
    })
    process.exitCode = 1
  }
}

function send(message: OutboundMessage): void {
  if (typeof process.send === 'function') {
    process.send(message)
  }
}

function toPortablePath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

void main()

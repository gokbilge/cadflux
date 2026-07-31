// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  createBatchReportArtifacts,
  createBatchReportFromResults
} from '@cadflux/batch-engine'
import type { CadFluxConversionResult, CadFluxFormat } from '@cadflux/core'
import { checksumFile } from '@cadflux/core/checksum'
import type { CadFluxDatabase, StoredArtifact, StoredJob } from '@cadflux/database'
import { zipSync, strToU8 } from 'fflate'

export async function generateJobReports(options: {
  database: CadFluxDatabase
  dataDir: string
  job: StoredJob
}): Promise<StoredArtifact[]> {
  const existingReportArtifacts = options.database
    .listArtifactsByJob(options.job.id)
    .filter(artifact =>
      ['json_report', 'csv_report', 'html_report', 'manifest', 'zip'].includes(artifact.type)
    )
  for (const artifact of existingReportArtifacts) {
    options.database.deleteArtifact(artifact.id)
  }

  const files = options.database.listJobFiles(options.job.id)
  const artifacts = options.database.listArtifactsByJob(options.job.id)
  const conversionArtifacts = artifacts.filter(artifact =>
    artifact.type === 'pdf' || artifact.type === 'svg'
  )
  const results = files.map(file => {
    const fileArtifacts = conversionArtifacts
      .filter(artifact => artifact.jobFileId === file.id)
      .map(artifact => ({
        format: artifact.format as CadFluxFormat,
        outputPath: artifact.storedPath
      }))
    return {
      input: {
        name: file.originalName,
        relativePath: file.relativePath,
        extension: path.extname(file.originalName).toLowerCase()
      },
      status:
        file.status === 'completed' || file.status === 'completed_with_warnings'
          ? 'completed'
          : file.status === 'cancelled'
            ? 'cancelled'
            : 'failed',
      artifacts: fileArtifacts,
      warnings: file.diagnosticsJson ? JSON.parse(file.diagnosticsJson) as string[] : [],
      durationMs: 0,
      error: file.errorMessage
    } satisfies CadFluxConversionResult
  })

  const report = createBatchReportFromResults(
    {
      presetId: tryReadPresetId(options.job.profileJson),
      strategy: 'filesystem',
      formatIds: uniqueFormats(conversionArtifacts)
    },
    results,
    (_result, artifact) => {
      const stored = conversionArtifacts.find(item => item.storedPath === artifact.outputPath)
      return {
        format: artifact.format,
        relativeOutputPath: stored?.relativePath ?? path.basename(artifact.outputPath),
        outputPath: artifact.outputPath,
        sizeBytes: stored?.sizeBytes
      }
    }
  )
  const reportFiles = createBatchReportArtifacts(report)
  const reportsRoot = path.join(options.dataDir, 'jobs', options.job.id, 'reports')
  const bundleRoot = path.join(options.dataDir, 'jobs', options.job.id, 'bundle')
  await mkdir(reportsRoot, { recursive: true })
  await mkdir(bundleRoot, { recursive: true })

  const jsonPath = path.join(reportsRoot, 'report.json')
  const csvPath = path.join(reportsRoot, 'report.csv')
  const htmlPath = path.join(reportsRoot, 'report.html')
  const manifestPath = path.join(reportsRoot, 'manifest.json')
  await writeFile(jsonPath, reportFiles.json, 'utf8')
  await writeFile(csvPath, reportFiles.csv, 'utf8')
  await writeFile(htmlPath, reportFiles.html, 'utf8')
  await writeFile(manifestPath, reportFiles.manifest, 'utf8')

  const zipPath = path.join(bundleRoot, `cadflux-job-${options.job.id}.zip`)
  const zipEntries: Record<string, Uint8Array> = {
    'reports/report.json': strToU8(reportFiles.json),
    'reports/report.csv': strToU8(reportFiles.csv),
    'reports/report.html': strToU8(reportFiles.html),
    'manifest.json': strToU8(reportFiles.manifest)
  }
  for (const artifact of conversionArtifacts) {
    zipEntries[`output/${artifact.relativePath}`] = new Uint8Array(await readFile(artifact.storedPath))
  }
  await writeFile(zipPath, Buffer.from(zipSync(zipEntries, { level: 0 })))

  const createdAt = new Date().toISOString()
  const created: StoredArtifact[] = []
  for (const descriptor of [
    { type: 'json_report', format: 'json', relativePath: 'reports/report.json', storedPath: jsonPath, mimeType: 'application/json' },
    { type: 'csv_report', format: 'csv', relativePath: 'reports/report.csv', storedPath: csvPath, mimeType: 'text/csv; charset=utf-8' },
    { type: 'html_report', format: 'html', relativePath: 'reports/report.html', storedPath: htmlPath, mimeType: 'text/html; charset=utf-8' },
    { type: 'manifest', format: 'json', relativePath: 'reports/manifest.json', storedPath: manifestPath, mimeType: 'application/json' },
    { type: 'zip', format: 'zip', relativePath: `bundle/cadflux-job-${options.job.id}.zip`, storedPath: zipPath, mimeType: 'application/zip' }
  ] as const) {
    const details = await stat(descriptor.storedPath)
    const id = randomUUID()
    options.database.createArtifact({
      id,
      jobId: options.job.id,
      type: descriptor.type,
      format: descriptor.format,
      relativePath: descriptor.relativePath,
      storedPath: descriptor.storedPath,
      sizeBytes: details.size,
      checksum: await checksumFile(descriptor.storedPath),
      mimeType: descriptor.mimeType,
      fidelity: 'unknown',
      createdAt
    })
    created.push(options.database.getArtifactById(id)!)
  }

  return created
}

function tryReadPresetId(profileJson: string): string {
  try {
    const parsed = JSON.parse(profileJson) as { id?: string }
    return parsed.id ?? 'custom'
  } catch {
    return 'custom'
  }
}

function uniqueFormats(artifacts: StoredArtifact[]): CadFluxFormat[] {
  return Array.from(new Set(artifacts.map(artifact => artifact.format as CadFluxFormat)))
}

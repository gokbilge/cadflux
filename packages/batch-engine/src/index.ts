// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type {
  CadFluxConversionResult,
  CadFluxFormat,
  CadFluxStatus
} from '@cadflux/core'

export interface BatchTask<T> {
  id: string
  run: () => Promise<T>
}

export interface BatchProgress<T> {
  taskId: string
  completed: number
  total: number
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  result?: T
  error?: unknown
}

export interface CadFluxBatchReportArtifact {
  format: CadFluxFormat
  relativeOutputPath: string
  sizeBytes?: number
  outputPath?: string
}

export interface CadFluxBatchReportItem {
  title: string
  relativePath: string
  status: Extract<CadFluxStatus, 'completed' | 'failed' | 'cancelled'>
  attempts: number
  durationMs?: number
  warnings?: string[]
  error?: string
  artifacts: CadFluxBatchReportArtifact[]
}

export interface CadFluxBatchReport {
  id: string
  createdAt: string
  presetId: string
  strategy: 'filesystem' | 'zip'
  formatIds: CadFluxFormat[]
  items: CadFluxBatchReportItem[]
}

export interface CadFluxBatchReportSummary {
  itemCount: number
  successCount: number
  failureCount: number
  cancelledCount: number
  artifactCount: number
  totalAttempts: number
}

export interface CadFluxBatchReportFiles {
  json: string
  csv: string
  html: string
  manifest: string
}

export class CadFluxBatchEngine<T = CadFluxConversionResult> {
  private paused = false
  private cancelled = false

  constructor(private readonly concurrency: number) {}

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }

  cancel() {
    this.cancelled = true
  }

  async run(
    tasks: BatchTask<T>[],
    onProgress?: (progress: BatchProgress<T>) => void
  ): Promise<T[]> {
    const pending = [...tasks]
    const results = new Array<T>(tasks.length)
    let completed = 0

    const worker = async () => {
      while (pending.length > 0 && !this.cancelled) {
        while (this.paused && !this.cancelled) {
          await delay(100)
        }
        const task = pending.shift()
        if (!task) {
          return
        }
        const resultIndex = tasks.indexOf(task)
        onProgress?.({
          taskId: task.id,
          completed,
          total: tasks.length,
          status: 'running'
        })
        try {
          const result = await task.run()
          results[resultIndex] = result
          completed += 1
          onProgress?.({
            taskId: task.id,
            completed,
            total: tasks.length,
            status: 'completed',
            result
          })
        } catch (error) {
          completed += 1
          onProgress?.({
            taskId: task.id,
            completed,
            total: tasks.length,
            status: this.cancelled ? 'cancelled' : 'failed',
            error
          })
          throw error
        }
      }
    }

    const workerCount = Math.max(1, Math.min(this.concurrency, tasks.length))
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
    return results.filter((result): result is T => result !== undefined)
  }
}

export function summarizeBatchReport(
  report: CadFluxBatchReport
): CadFluxBatchReportSummary {
  return report.items.reduce<CadFluxBatchReportSummary>(
    (summary, item) => {
      summary.itemCount += 1
      summary.totalAttempts += item.attempts
      summary.artifactCount += item.artifacts.length
      if (item.status === 'completed') {
        summary.successCount += 1
      } else if (item.status === 'failed') {
        summary.failureCount += 1
      } else {
        summary.cancelledCount += 1
      }
      return summary
    },
    {
      itemCount: 0,
      successCount: 0,
      failureCount: 0,
      cancelledCount: 0,
      artifactCount: 0,
      totalAttempts: 0
    }
  )
}

export function createBatchReportArtifacts(
  report: CadFluxBatchReport
): CadFluxBatchReportFiles {
  const summary = summarizeBatchReport(report)
  const json = JSON.stringify(
    {
      ...report,
      summary
    },
    null,
    2
  )
  const header = [
    'title',
    'relativePath',
    'status',
    'attempts',
    'durationMs',
    'artifactFormats',
    'artifactOutputs',
    'warnings',
    'error'
  ]
  const rows = report.items.map(item => [
    item.title,
    item.relativePath,
    item.status,
    String(item.attempts),
    String(item.durationMs ?? 0),
    item.artifacts.map(artifact => artifact.format).join('|'),
    item.artifacts
      .map(artifact => artifact.relativeOutputPath)
      .join('|'),
    (item.warnings ?? []).join('|'),
    item.error ?? ''
  ])
  const csv = [header, ...rows]
    .map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(','))
    .join('\n')

  const htmlRows = report.items
    .map(
      item => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.relativePath)}</td><td>${item.status}</td><td>${item.attempts}</td><td>${item.durationMs ?? 0}</td><td>${item.artifacts
        .map(artifact => `${artifact.format}: ${escapeHtml(artifact.relativeOutputPath)}`)
        .join('<br/>')}</td><td>${escapeHtml((item.warnings ?? []).join('; '))}</td><td>${escapeHtml(item.error ?? '')}</td></tr>`
    )
    .join('')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CadFlux Batch Report</title><style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;vertical-align:top}th{background:#f3f3f3;text-align:left}</style></head><body><h1>CadFlux Batch Report</h1><p>Preset: ${escapeHtml(
    report.presetId
  )}</p><p>Items: ${summary.itemCount} | Completed: ${summary.successCount} | Failed: ${summary.failureCount} | Cancelled: ${summary.cancelledCount} | Artifacts: ${summary.artifactCount}</p><table><thead><tr><th>Title</th><th>Relative path</th><th>Status</th><th>Attempts</th><th>Duration (ms)</th><th>Artifacts</th><th>Warnings</th><th>Error</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>`

  const manifest = JSON.stringify(
    {
      reportId: report.id,
      createdAt: report.createdAt,
      presetId: report.presetId,
      strategy: report.strategy,
      formats: report.formatIds,
      summary,
      outputs: report.items.flatMap(item =>
        item.artifacts.map(artifact => ({
          input: item.relativePath,
          status: item.status,
          format: artifact.format,
          output: artifact.relativeOutputPath,
          outputPath: artifact.outputPath,
          sizeBytes: artifact.sizeBytes
        }))
      )
    },
    null,
    2
  )

  return { json, csv, html, manifest }
}

export function createBatchReportFromResults(
  options: {
    id?: string
    createdAt?: string
    presetId: string
    strategy: 'filesystem' | 'zip'
    formatIds: CadFluxFormat[]
  },
  results: CadFluxConversionResult[],
  mapArtifact: (
    result: CadFluxConversionResult,
    artifact: CadFluxConversionResult['artifacts'][number]
  ) => CadFluxBatchReportArtifact
): CadFluxBatchReport {
  return {
    id: options.id ?? createBatchReportId(),
    createdAt: options.createdAt ?? new Date().toISOString(),
    presetId: options.presetId,
    strategy: options.strategy,
    formatIds: options.formatIds,
    items: results.map(result => ({
      title: result.input.name,
      relativePath:
        result.input.relativePath ?? result.input.absolutePath ?? result.input.name,
      status: result.status === 'completed' ? 'completed' : 'failed',
      attempts: 1,
      durationMs: result.durationMs,
      warnings: [...result.warnings],
      error: result.error,
      artifacts: result.artifacts.map(artifact => mapArtifact(result, artifact))
    }))
  }
}

export function createBatchReportId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `cadflux-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

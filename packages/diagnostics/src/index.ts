// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type {
  CadFluxConversionResult,
  CadFluxDiagnosticsEntry
} from '@cadflux/core'

export function createDiagnostic(
  code: string,
  level: CadFluxDiagnosticsEntry['level'],
  message: string,
  inputPath?: string
): CadFluxDiagnosticsEntry {
  return {
    code,
    level,
    message,
    inputPath,
    timestamp: new Date().toISOString()
  }
}

export function resultsToJson(results: CadFluxConversionResult[]): string {
  return JSON.stringify(results, null, 2)
}

export function resultsToCsv(results: CadFluxConversionResult[]): string {
  const header = [
    'input',
    'status',
    'artifacts',
    'warnings',
    'durationMs',
    'error'
  ]
  const rows = results.map(result => [
    result.input.absolutePath ?? result.input.relativePath ?? result.input.name,
    result.status,
    result.artifacts.map(artifact => artifact.outputPath).join('|'),
    result.warnings.join('|'),
    String(result.durationMs),
    result.error ?? ''
  ])

  return [header, ...rows]
    .map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(','))
    .join('\n')
}

export function resultsToHtml(results: CadFluxConversionResult[]): string {
  const rows = results
    .map(result => {
      const input =
        result.input.absolutePath ?? result.input.relativePath ?? result.input.name
      const artifacts = result.artifacts
        .map(artifact => `<li>${artifact.format}: ${artifact.outputPath}</li>`)
        .join('')
      const warnings = result.warnings.map(warning => `<li>${warning}</li>`).join('')
      return `<tr><td>${escapeHtml(input)}</td><td>${result.status}</td><td><ul>${artifacts}</ul></td><td><ul>${warnings}</ul></td><td>${result.durationMs}</td><td>${escapeHtml(result.error ?? '')}</td></tr>`
    })
    .join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CadFlux Report</title><style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;vertical-align:top}th{background:#f3f3f3;text-align:left}ul{margin:0;padding-left:18px}</style></head><body><h1>CadFlux Conversion Report</h1><table><thead><tr><th>Input</th><th>Status</th><th>Artifacts</th><th>Warnings</th><th>Duration</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

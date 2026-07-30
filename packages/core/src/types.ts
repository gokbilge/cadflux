// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export type CadFluxFormat = 'pdf' | 'svg'

export type CadFluxStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface CadFluxInputSource {
  name: string
  absolutePath?: string
  relativePath?: string
  extension: string
  sizeBytes?: number
  lastModifiedMs?: number
  browserFile?: File
}

export interface CadFluxInspection {
  input: CadFluxInputSource
  detectedFormat: 'dwg' | 'dxf' | 'unknown'
  warnings: string[]
}

export interface CadFluxProfile {
  id: string
  label: string
  paper: 'A0' | 'A1' | 'A2' | 'A3' | 'A4'
  orientation: 'portrait' | 'landscape' | 'auto'
  scale: 'fit' | string
  color: 'color' | 'monochrome'
  formats: CadFluxFormat[]
}

export interface CadFluxConversionRequest {
  input: CadFluxInputSource
  outputDirectory: string
  profile: CadFluxProfile
  preserveTree: boolean
  overwrite: 'skip' | 'replace'
}

export interface CadFluxArtifact {
  format: CadFluxFormat
  outputPath: string
}

export interface CadFluxConversionResult {
  input: CadFluxInputSource
  status: Exclude<CadFluxStatus, 'pending' | 'running'>
  artifacts: CadFluxArtifact[]
  warnings: string[]
  durationMs: number
  error?: string
}

export interface CadFluxDiagnosticsEntry {
  code: string
  level: 'info' | 'warning' | 'error'
  message: string
  inputPath?: string
  timestamp: string
}

export interface CadFluxConverter {
  inspect(input: CadFluxInputSource): Promise<CadFluxInspection>
  convert(request: CadFluxConversionRequest): Promise<CadFluxConversionResult>
}

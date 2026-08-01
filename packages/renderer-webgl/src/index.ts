// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export * from './viewer-types'
export * from './viewer-core'
export * from './render-plan'

export interface CadFluxViewerRuntime {
  readMode: 'read'
  viewerCreated(): void
}

export async function ensureCadFluxViewerLocale(_locale = 'en'): Promise<void> {
  return
}

export async function loadCadFluxViewerComponent(): Promise<unknown> {
  const module = await import('./CadFluxWebViewer')
  return module.CadFluxWebViewer
}

export async function loadCadFluxViewerRuntime(): Promise<CadFluxViewerRuntime> {
  return {
    readMode: 'read',
    viewerCreated() {
      return
    }
  }
}

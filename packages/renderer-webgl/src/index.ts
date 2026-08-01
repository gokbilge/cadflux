// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export interface CadFluxViewerRuntime {
  readMode: unknown
  viewerCreated(): void
}

export async function ensureCadFluxViewerLocale(_locale = 'en'): Promise<void> {
  const { AcApI18n } = await import('./cadflux-i18n/AcApI18n')
  AcApI18n.setCurrentLocale('en')
}

export async function loadCadFluxViewerComponent(): Promise<unknown> {
  const module = await import('./CadFluxWebViewer')
  return module.CadFluxWebViewer
}

export async function loadCadFluxViewerRuntime(): Promise<CadFluxViewerRuntime> {
  const { AcEdOpenMode } = await import('./mlightcad-bridge/app')

  return {
    readMode: AcEdOpenMode.Read,
    viewerCreated() {
      // Reserved hook for future CadFlux-specific viewer setup.
    }
  }
}

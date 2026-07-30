// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export interface CadFluxViewerRuntime {
  readMode: unknown
  viewerCreated(): void
  execute(command: 'cpdf' | 'csvg'): Promise<void>
}

export async function ensureCadFluxViewerLocale(locale = 'en'): Promise<void> {
  const module = await import('@mlightcad/cad-simple-viewer')
  module.AcApI18n.setCurrentLocale(locale as 'en' | 'zh' | 'tr' | 'cs')
}

export async function loadCadFluxViewerComponent(): Promise<unknown> {
  const module = await import('./CadFluxWebViewer')
  return module.CadFluxWebViewer
}

export async function loadCadFluxViewerRuntime(): Promise<CadFluxViewerRuntime> {
  const simpleViewerModule = await import('@mlightcad/cad-simple-viewer')

  const { AcApDocManager, AcEdOpenMode } = simpleViewerModule

  return {
    readMode: AcEdOpenMode.Read,
    viewerCreated() {
      // Reserved hook for future CadFlux-specific viewer setup.
    },
    async execute(command: 'cpdf' | 'csvg') {
      if (command === 'csvg') {
        const { AcApSvgConvertor } = await import(
          '@mlightcad/cad-svg-plugin/convertor'
        )
        await new AcApSvgConvertor().convert(AcApDocManager.instance.context)
      } else {
        const { AcApPdfConvertor } = await import(
          '@mlightcad/cad-pdf-plugin/convertor'
        )
        await new AcApPdfConvertor().convert(AcApDocManager.instance.context)
      }
    }
  }
}

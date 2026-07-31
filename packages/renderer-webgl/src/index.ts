// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export interface CadFluxViewerRuntime {
  readMode: unknown
  viewerCreated(): void
  execute(command: 'cpdf' | 'csvg'): Promise<void>
  exportCurrent(command: 'cpdf' | 'csvg'): Promise<{
    format: 'pdf' | 'svg'
    downloadName: string
    blob: Blob
  }>
}

export async function ensureCadFluxViewerLocale(locale = 'en'): Promise<void> {
  const { AcApI18n } = await import('./cadflux-i18n/AcApI18n')
  AcApI18n.setCurrentLocale(locale as 'en' | 'zh' | 'tr' | 'cs')
}

export async function loadCadFluxViewerComponent(): Promise<unknown> {
  const module = await import('./CadFluxWebViewer')
  return module.CadFluxWebViewer
}

export async function loadCadFluxViewerRuntime(): Promise<CadFluxViewerRuntime> {
  const [{ AcApDocManager }, { AcEdOpenMode }] = await Promise.all([
    import('./cadflux-app/AcApDocManager'),
    import('../../cad-simple-viewer/src/editor/view/AcEdOpenMode')
  ])

  const exportCurrent = async (command: 'cpdf' | 'csvg') => {
    if (command === 'csvg') {
      const module = (await import(
        '@mlightcad/cad-svg-plugin/convertor'
      )) as unknown as {
        AcApSvgConvertor: new () => {
          render: (
            context: unknown
          ) => Promise<{ downloadName: string; blob: Blob }>
        }
      }
      const result = await new module.AcApSvgConvertor().render(
        AcApDocManager.instance.context
      )
      return {
        format: 'svg' as const,
        downloadName: result.downloadName,
        blob: result.blob
      }
    }

    const module = (await import(
      '@mlightcad/cad-pdf-plugin/convertor'
    )) as unknown as {
      AcApPdfConvertor: new () => {
        render: (
          context: unknown
        ) => Promise<{ downloadName: string; blob: Blob }>
      }
    }
    const result = await new module.AcApPdfConvertor().render(
      AcApDocManager.instance.context
    )
    return {
      format: 'pdf' as const,
      downloadName: result.downloadName,
      blob: result.blob
    }
  }

  return {
    readMode: AcEdOpenMode.Read,
    viewerCreated() {
      // Reserved hook for future CadFlux-specific viewer setup.
    },
    exportCurrent,
    async execute(command: 'cpdf' | 'csvg') {
      const artifact = await exportCurrent(command)
      const url = URL.createObjectURL(artifact.blob)
      try {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = artifact.downloadName
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
    }
  }
}

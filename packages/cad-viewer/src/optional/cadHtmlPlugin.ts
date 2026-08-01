import type { AcTrView2d } from '@mlightcad/cad-simple-viewer/src/view/AcTrView2d'

export type AcExInitialViewMode = 'fit' | 'current'
export type AcExViewerMode = 'view' | 'measure'

export interface AcApHtmlExportOptions {
  exportInvisibleLayers?: boolean
  initialView?: AcExInitialViewMode
  viewerMode?: AcExViewerMode
}

export function registerOptionalHtmlPlugin() {
  // CadFlux does not expose the upstream HTML export plugin.
}

export function resolveAcApHtmlExportOptions(
  options: AcApHtmlExportOptions
): AcApHtmlExportOptions {
  return options
}

export class AcApHtmlConvertor {
  async convert(
    _fileName: string,
    _options: AcApHtmlExportOptions,
    _view: AcTrView2d
  ): Promise<void> {
    throw new Error(
      'HTML export is not included in CadFlux. Use PDF or SVG export instead.'
    )
  }
}

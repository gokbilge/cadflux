import { readCadFluxBrowserFontMapping } from '@cadflux/core'
import type { AcApContext } from '@mlightcad/cad-simple-viewer'
import type { AcSvgRenderer } from '@mlightcad/cad-svg-plugin/renderer'

export interface CadFluxPdfExportResult {
  downloadName: string
  svgString: string
  blob: Blob
}

/**
 * Utility class for converting CAD drawings to PDF format.
 *
 * Reuses the SVG renderer pipeline and converts the resulting SVG to a
 * vector PDF using jsPDF + svg2pdf.js.
 */
export class AcApPdfConvertor {
  /**
   * Renders the current drawing to PDF and triggers a browser download.
   */
  async convert(context: AcApContext) {
    const result = await this.render(context)
    this.downloadResult(result)
  }

  async render(context: AcApContext): Promise<CadFluxPdfExportResult> {
    const svgString = await this.buildSvg(context)
    const { resolveCadFluxExportDownloadName } = await import(
      './CadFluxBrowserExport'
    )
    const downloadName = resolveCadFluxExportDownloadName(
      context.doc.fileName || context.doc.docTitle,
      'pdf'
    )
    return {
      downloadName,
      svgString,
      blob: await this.buildPdfBlob(svgString)
    }
  }

  private async buildSvg(context: AcApContext): Promise<string> {
    const { AcSvgRenderer } = await import('@mlightcad/cad-svg-plugin/renderer')
    AcSvgRenderer.prepareExport()

    const entities =
      context.doc.database.tables.blockTable.modelSpace.newIterator()
    const renderer = new AcSvgRenderer()
    this.configureRenderer(renderer, context)

    for (const entity of entities) {
      entity.worldDraw(renderer)
    }
    return renderer.exportAsync()
  }

  private configureRenderer(renderer: AcSvgRenderer, context: AcApContext) {
    const db = context.doc.database
    renderer.ltscale = db.ltscale
    renderer.celtscale = db.celtscale
    renderer.showLineWeight = !!db.lwdisplay
    renderer.setFontMapping(readCadFluxBrowserFontMapping())

    const view = context.view as { backgroundColor?: number } | undefined
    const bg = view?.backgroundColor ?? 0xffffff
    renderer.currentBackgroundColor = bg
    renderer.changeForeground(bg === 0 ? 0xffffff : 0x000000)
  }

  downloadResult(result: CadFluxPdfExportResult) {
    const url = URL.createObjectURL(result.blob)
    const downloadLink = document.createElement('a')
    downloadLink.href = url
    downloadLink.download = result.downloadName
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  private async buildPdfBlob(svgString: string): Promise<Blob> {
    const [{ jsPDF }, { svg2pdf }] = await Promise.all([
      import('jspdf'),
      import('svg2pdf.js')
    ])
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
    const svgEl = svgDoc.documentElement as unknown as SVGSVGElement

    const vb = svgEl.getAttribute('viewBox')?.split(' ').map(Number)
    const vbWidth = vb && vb.length === 4 ? Math.abs(vb[2]) : 297
    const vbHeight = vb && vb.length === 4 ? Math.abs(vb[3]) : 210

    const orientation = vbWidth >= vbHeight ? 'landscape' : 'portrait'

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [vbWidth, vbHeight]
    })

    await svg2pdf(svgEl, pdf, {
      x: 0,
      y: 0,
      width: vbWidth,
      height: vbHeight
    })

    return pdf.output('blob')
  }

}

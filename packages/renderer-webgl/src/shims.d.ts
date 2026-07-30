declare module '@mlightcad/cad-svg-plugin/convertor' {
  export class AcApSvgConvertor {
    convert(context: unknown): Promise<void>
  }
}

declare module '@mlightcad/cad-pdf-plugin/convertor' {
  export class AcApPdfConvertor {
    convert(context: unknown): Promise<void>
  }
}

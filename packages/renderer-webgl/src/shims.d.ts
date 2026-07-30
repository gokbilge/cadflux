// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

declare module '@mlightcad/cad-viewer' {
  import type { Component } from 'vue'

  export const MlCadViewer: Component
}

declare module '@mlightcad/cad-simple-viewer' {
  export const AcApDocManager: {
    instance: {
      pluginManager: unknown
      sendStringToExecute(command: string): Promise<void>
    }
  }
  export const AcEdOpenMode: {
    Read: unknown
  }
}

declare module '@mlightcad/cad-svg-plugin/register' {
  export function registerLazySvgPlugin(pluginManager: unknown): void
}

declare module '@mlightcad/cad-pdf-plugin/register' {
  export function registerLazyPdfPlugin(pluginManager: unknown): void
}

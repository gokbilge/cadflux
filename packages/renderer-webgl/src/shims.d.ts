// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

declare module '@mlightcad/cad-simple-viewer' {
  export const AcApI18n: {
    setCurrentLocale(locale: 'en' | 'zh' | 'tr' | 'cs'): void
  }
  export const AcApDocManager: {
    createInstance(options: {
      container?: HTMLElement
      autoResize?: boolean
      baseUrl?: string
      builtinOpenFileDialog?: boolean
    }): {
      openDocument(
        fileName: string,
        content: ArrayBuffer,
        options?: { mode?: number }
      ): Promise<boolean>
      destroy(): Promise<void>
      curDocument: {
        database: {
          currentSpaceId: string
          objects: {
            layout: {
              newIterator(): Iterable<{
                layoutName: string
                tabOrder: number
                blockTableRecordId: string
              }>
            }
          }
        }
        layerStore: {
          getCurrentLayerName(): string
          getLayers(): Array<{
            name: string
            cssColor: string
            isOn: boolean
            isFrozen: boolean
            isLocked: boolean
          }>
          setLayerOn(layerName: string, isOn: boolean): boolean
          setLayerFrozen(layerName: string, frozen: boolean): boolean
          events: {
            changed: {
              addEventListener(
                listener: (args: AcApLayerStoreChangedEventArgs) => void
              ): void
              removeEventListener(
                listener: (args: AcApLayerStoreChangedEventArgs) => void
              ): void
            }
          }
        }
      }
      events: {
        documentActivated: {
          addEventListener(listener: () => void): void
          removeEventListener(listener: () => void): void
        }
      }
    }
    instance: {
      pluginManager: unknown
      sendStringToExecute(command: string): Promise<void>
      destroy(): Promise<void>
    }
  }
  export interface AcApLayerStoreChangedEventArgs {
    currentLayerName: string
    layers: Array<{
      name: string
      cssColor: string
      isOn: boolean
      isFrozen: boolean
      isLocked: boolean
    }>
  }
  export const AcEdOpenMode: {
    Read: number
  }
}

declare module '@mlightcad/cad-svg-plugin/register' {
  export function registerLazySvgPlugin(pluginManager: unknown): void
}

declare module '@mlightcad/cad-pdf-plugin/register' {
  export function registerLazyPdfPlugin(pluginManager: unknown): void
}

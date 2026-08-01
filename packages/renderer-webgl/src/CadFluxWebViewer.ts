// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors
// @ts-nocheck

import { acdbHostApplicationServices } from '@mlightcad/data-model'
import { AcApDocManager } from './cadflux-app/AcApDocManager'
import { AcApI18n } from './cadflux-i18n/AcApI18n'
import type { AcApLayerStoreChangedEventArgs } from './mlightcad-bridge/service'
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType
} from 'vue'

type CadFluxDocManager = InstanceType<typeof AcApDocManager>

interface LayoutOption {
  name: string
  tabOrder: number
  blockTableRecordId: string
  isActive: boolean
}

interface LayerOption {
  name: string
  cssColor: string
  isOn: boolean
  isFrozen: boolean
  isLocked: boolean
}

function readLayouts(docManager: CadFluxDocManager): LayoutOption[] {
  const db = docManager.curDocument.database
  const layouts: LayoutOption[] = []
  for (const layout of db.objects.layout.newIterator()) {
    layouts.push({
      name: layout.layoutName,
      tabOrder: layout.tabOrder,
      blockTableRecordId: layout.blockTableRecordId,
      isActive: layout.blockTableRecordId === db.currentSpaceId
    })
  }
  layouts.sort((left, right) => left.tabOrder - right.tabOrder)
  return layouts
}

function readCurrentLayoutId(layouts: LayoutOption[]): string {
  return layouts.find(layout => layout.isActive)?.blockTableRecordId ?? ''
}

function readLayers(docManager: CadFluxDocManager): {
  currentLayerName: string
  layers: LayerOption[]
} {
  const store = docManager.curDocument.layerStore
  return {
    currentLayerName: store.getCurrentLayerName(),
    layers: store.getLayers().map(layer => ({
      name: layer.name,
      cssColor: layer.cssColor,
      isOn: layer.isOn,
      isFrozen: layer.isFrozen,
      isLocked: layer.isLocked
    }))
  }
}

export const CadFluxWebViewer = defineComponent({
  name: 'CadFluxWebViewer',
  props: {
    localFile: {
      type: Object as PropType<File | null | undefined>,
      default: null
    },
    mode: {
      type: Number as PropType<number | undefined>,
      default: undefined
    },
    baseUrl: {
      type: String,
      default: ''
    }
  },
  emits: ['create', 'document-opened'],
  setup(props, { emit }) {
    const hostRef = ref<HTMLElement | null>(null)
    const isReady = ref(false)
    const isOpening = ref(false)
    const errorMessage = ref('')
    const layouts = ref<LayoutOption[]>([])
    const activeLayoutId = ref('')
    const currentLayerName = ref('')
    const layers = ref<LayerOption[]>([])
    let docManager: CadFluxDocManager | null = null

    const syncLayouts = () => {
      if (!docManager) {
        layouts.value = []
        activeLayoutId.value = ''
        return
      }
      const nextLayouts = readLayouts(docManager)
      layouts.value = nextLayouts
      activeLayoutId.value = readCurrentLayoutId(nextLayouts)
    }

    const syncLayers = () => {
      if (!docManager) {
        currentLayerName.value = ''
        layers.value = []
        return
      }
      const snapshot = readLayers(docManager)
      currentLayerName.value = snapshot.currentLayerName
      layers.value = snapshot.layers
    }

    const handleDocumentActivated = () => {
      errorMessage.value = ''
      syncLayouts()
      syncLayers()
    }

    const handleLayoutSwitched = () => {
      syncLayouts()
    }

    const handleLayerStoreChanged = (args: AcApLayerStoreChangedEventArgs) => {
      currentLayerName.value = args.currentLayerName
      layers.value = args.layers.map(layer => ({
        name: layer.name,
        cssColor: layer.cssColor,
        isOn: layer.isOn,
        isFrozen: layer.isFrozen,
        isLocked: layer.isLocked
      }))
    }

    const bindRuntimeListeners = () => {
      if (!docManager) {
        return
      }
      docManager.events.documentActivated.addEventListener(handleDocumentActivated)
      acdbHostApplicationServices().layoutManager.events.layoutSwitched.addEventListener(
        handleLayoutSwitched
      )
      docManager.curDocument.layerStore.events.changed.addEventListener(
        handleLayerStoreChanged
      )
    }

    const unbindRuntimeListeners = () => {
      if (!docManager) {
        return
      }
      docManager.events.documentActivated.removeEventListener(handleDocumentActivated)
      acdbHostApplicationServices().layoutManager.events.layoutSwitched.removeEventListener(
        handleLayoutSwitched
      )
      docManager.curDocument.layerStore.events.changed.removeEventListener(
        handleLayerStoreChanged
      )
    }

    const openActiveFile = async () => {
      if (!docManager || !props.localFile) {
        return
      }

      isOpening.value = true
      errorMessage.value = ''
      try {
        const fileBuffer = await props.localFile.arrayBuffer()
        const success = await docManager.openDocument(props.localFile.name, fileBuffer, {
          mode: props.mode
        })

        if (!success) {
          errorMessage.value = `Failed to open ${props.localFile.name}.`
          emit('document-opened', {
            fileName: props.localFile.name,
            success: false
          })
          return
        }

        syncLayouts()
        syncLayers()
        emit('document-opened', {
          fileName: props.localFile.name,
          success: true
        })
      } catch (error) {
        errorMessage.value =
          error instanceof Error
            ? error.message
            : `Failed to open ${props.localFile.name}.`
        emit('document-opened', {
          fileName: props.localFile.name,
          success: false
        })
      } finally {
        isOpening.value = false
      }
    }

    const initializeViewer = async () => {
      if (!hostRef.value) {
        return
      }

      AcApI18n.setCurrentLocale('en')

      try {
        await AcApDocManager.instance.destroy()
      } catch {
        // No active singleton to dispose.
      }

      docManager = AcApDocManager.createInstance({
        container: hostRef.value,
        autoResize: true,
        baseUrl: props.baseUrl,
        builtinOpenFileDialog: false
      })

      bindRuntimeListeners()
      syncLayouts()
      syncLayers()
      isReady.value = true
      emit('create')
      await openActiveFile()
    }

    const destroyViewer = async () => {
      if (!docManager) {
        return
      }
      unbindRuntimeListeners()
      const activeManager = docManager
      docManager = null
      isReady.value = false
      layouts.value = []
      layers.value = []
      currentLayerName.value = ''
      activeLayoutId.value = ''
      await activeManager.destroy()
    }

    const handleLayoutChange = (event: Event) => {
      const nextLayoutId = (event.target as HTMLSelectElement).value
      if (!nextLayoutId) {
        return
      }
      activeLayoutId.value = nextLayoutId
      acdbHostApplicationServices().layoutManager.setCurrentLayoutBtrId(nextLayoutId)
    }

    const handleLayerOnToggle = (layerName: string, isOn: boolean) => {
      docManager?.curDocument.layerStore.setLayerOn(layerName, isOn)
    }

    const handleLayerFrozenToggle = (layerName: string, frozen: boolean) => {
      docManager?.curDocument.layerStore.setLayerFrozen(layerName, frozen)
    }

    onMounted(() => {
      void initializeViewer()
    })

    onBeforeUnmount(() => {
      void destroyViewer()
    })

    watch(
      () => props.localFile,
      () => {
        if (isReady.value) {
          void openActiveFile()
        }
      }
    )

    return () =>
      h(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateRows: 'auto 1fr',
            minHeight: '0',
            height: '100%'
          }
        },
        [
          h(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 320px',
                gap: '12px',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(31, 42, 38, 0.08)',
                background: 'rgba(255, 255, 255, 0.72)'
              }
            },
            [
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }
                },
                [
                  h('label', { style: { display: 'grid', gap: '4px' } }, [
                    h(
                      'span',
                      {
                        style: {
                          fontSize: '0.8rem',
                          color: 'rgba(31, 42, 38, 0.72)'
                        }
                      },
                      'Layout'
                    ),
                    h(
                      'select',
                      {
                        value: activeLayoutId.value,
                        onChange: handleLayoutChange,
                        style: {
                          minWidth: '180px',
                          borderRadius: '12px',
                          border: '1px solid rgba(31, 42, 38, 0.12)',
                          padding: '8px 12px',
                          background: '#fff'
                        }
                      },
                      layouts.value.map(layout =>
                        h(
                          'option',
                          {
                            key: layout.blockTableRecordId,
                            value: layout.blockTableRecordId
                          },
                          layout.name
                        )
                      )
                    )
                  ]),
                  h(
                    'div',
                    {
                      style: {
                        color: 'rgba(31, 42, 38, 0.72)',
                        fontSize: '0.9rem'
                      }
                    },
                    currentLayerName.value
                      ? `Current layer: ${currentLayerName.value}`
                      : 'No active layer'
                  ),
                  errorMessage.value
                    ? h(
                        'div',
                        {
                          style: {
                            color: '#8b2f2f',
                            fontSize: '0.9rem'
                          }
                        },
                        errorMessage.value
                      )
                    : null,
                  isOpening.value
                    ? h(
                        'div',
                        {
                          style: {
                            color: 'rgba(31, 42, 38, 0.72)',
                            fontSize: '0.9rem'
                          }
                        },
                        'Opening drawing…'
                      )
                    : null
                ]
              ),
              h(
                'div',
                {
                  style: {
                    display: 'grid',
                    gap: '6px',
                    maxHeight: '120px',
                    overflow: 'auto',
                    paddingRight: '4px'
                  }
                },
                layers.value.map(layer =>
                  h(
                    'label',
                    {
                      key: layer.name,
                      style: {
                        display: 'grid',
                        gridTemplateColumns: 'auto auto 1fr auto',
                        gap: '8px',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                        padding: '4px 0'
                      }
                    },
                    [
                      h('input', {
                        type: 'checkbox',
                        checked: layer.isOn,
                        onChange: (event: Event) =>
                          handleLayerOnToggle(
                            layer.name,
                            (event.target as HTMLInputElement).checked
                          )
                      }),
                      h('input', {
                        type: 'checkbox',
                        checked: !layer.isFrozen,
                        title: 'Visible in thawed state',
                        onChange: (event: Event) =>
                          handleLayerFrozenToggle(
                            layer.name,
                            !(event.target as HTMLInputElement).checked
                          )
                      }),
                      h(
                        'span',
                        {
                          style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: '0'
                          }
                        },
                        [
                          h('span', {
                            style: {
                              width: '10px',
                              height: '10px',
                              borderRadius: '999px',
                              background: layer.cssColor,
                              border: '1px solid rgba(31, 42, 38, 0.12)',
                              flex: '0 0 auto'
                            }
                          }),
                          h(
                            'span',
                            {
                              style: {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }
                            },
                            layer.name
                          )
                        ]
                      ),
                      h(
                        'span',
                        {
                          style: {
                            color: 'rgba(31, 42, 38, 0.56)'
                          }
                        },
                        layer.isLocked ? 'locked' : ''
                      )
                    ]
                  )
                )
              )
            ]
          ),
          h(
            'div',
            {
              style: {
                position: 'relative',
                minHeight: '0',
                background: '#d6d0c4'
              }
            },
            [
              h('div', {
                ref: hostRef,
                style: {
                  width: '100%',
                  height: '100%'
                }
              })
            ]
          )
        ]
      )
  }
})
